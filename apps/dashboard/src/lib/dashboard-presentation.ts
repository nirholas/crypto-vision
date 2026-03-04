/**
 * Dashboard-integrated Presentation Mode
 *
 * Extends PresentationMode to broadcast events to connected dashboard clients
 * via the swarm event manager.
 */

import { PresentationMode, PresentationConfig, PresentationSummary } from '../presentation.js';
import { swarmEventManager } from '@/app/api/swarm/events/route';

/**
 * Enhanced presentation mode that broadcasts to dashboard
 */
export class DashboardPresentationMode extends PresentationMode {
  /**
   * Override narration to broadcast to dashboard
   */
  async runPresentation(): Promise<PresentationSummary> {
    // Broadcast start
    swarmEventManager.broadcastStatus(true);

    try {
      const summary = await super.runPresentation();
      
      // Broadcast completion
      swarmEventManager.broadcastStatus(false);
      swarmEventManager.broadcastEvent('completed', 'Presentation complete!', {
        budget: summary.metrics.finalPnl,
        trades: summary.metrics.tradeCount,
        roi: summary.metrics.roi,
      });

      return summary;
    } catch (error) {
      swarmEventManager.broadcastStatus(false);
      swarmEventManager.broadcastEvent('error', 
        error instanceof Error ? error.message : 'Unknown error occurred');
      throw error;
    }
  }
}

/**
 * Broadcast utility functions for integration with presentation mode
 */
export const swarmBroadcast = {
  narration: (text: string, metrics?: any) => {
    swarmEventManager.broadcastNarration(text, metrics);
  },

  metrics: (metrics: any) => {
    swarmEventManager.broadcastMetrics(metrics);
  },

  event: (type: string, narration: string, metrics?: any) => {
    swarmEventManager.broadcastEvent(type, narration, metrics);
  },

  status: (isRunning: boolean) => {
    swarmEventManager.broadcastStatus(isRunning);
  },

  walletGeneration: (count: number) => {
    swarmEventManager.broadcastEvent(
      'wallet',
      `${count} independent Solana wallets are being generated, each controlled by a different AI agent.`,
    );
  },

  tokenCreated: (mint: string, devBuySol: number) => {
    swarmEventManager.broadcastEvent(
      'token-created',
      `An AI agent has autonomously created a new token on Pump.fun with a ${devBuySol} SOL dev buy.`,
      { tokenMint: mint, devBuySol }
    );
  },

  trade: (direction: string, amount: number, tradeCount: number) => {
    swarmEventManager.broadcastEvent(
      'trade',
      `Trade #${tradeCount}: ${direction.toUpperCase()} ${amount.toFixed(2)} SOL executed based on AI analysis.`,
      { tradeCount, direction, amount }
    );
  },

  graduated: (mint: string) => {
    swarmEventManager.broadcastEvent(
      'graduated',
      `Token graduated to Raydium AMM! Mission accomplished through autonomous agent coordination.`,
      { tokenMint: mint }
    );
  },

  strategyDecision: (decision: string, confidence: number) => {
    swarmEventManager.broadcastEvent(
      'strategy',
      `Strategy decision: ${decision} (confidence: ${(confidence * 100).toFixed(0)}%)`,
      { decision, confidence }
    );
  },
};
