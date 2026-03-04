/**
 * Integration Example: Swarm Monitor with Presentation Mode
 *
 * This file demonstrates how to connect the autonomous swarm to the
 * dashboard real-time monitor using the broadcast utilities.
 */

import { PresentationMode, DEFAULT_PRESENTATION_CONFIG } from '../demo/presentation.js';
import { swarmBroadcast } from '@/lib/dashboard-presentation';
import type { SwarmStatus } from '../types.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

/**
 * Enhanced PresentationMode that broadcasts to dashboard
 */
export class DashboardIntegratedPresentation extends PresentationMode {
  private updateInterval: NodeJS.Timeout | null = null;
  private lastMetricsUpdate = 0;

  async runPresentation() {
    // Start broadcasting
    swarmBroadcast.status(true);
    swarmBroadcast.event(
      'init',
      'Initializing autonomous AI agent swarm for live demonstration...'
    );

    try {
      // Call parent runPresentation (from presentation.ts)
      const summary = await super.runPresentation();

      // Broadcast completion
      swarmBroadcast.status(false);
      swarmBroadcast.event(
        'completed',
        '✅ Presentation complete! All agents have finished trading.',
        {
          budget: summary.metrics.finalPnl,
          trades: summary.metrics.tradeCount,
          roi: summary.metrics.roi,
        }
      );

      return summary;
    } catch (error) {
      swarmBroadcast.status(false);
      const message = error instanceof Error ? error.message : 'Unknown error';
      swarmBroadcast.event('error', `⚠️ Error: ${message}`);
      throw error;
    } finally {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
    }
  }
}

/**
 * Hook up event listeners to broadcast swarm events to dashboard
 */
export function setupSwarmMonitoring(presenter: PresentationMode) {
  // This would typically be done inside PresentationMode.setupEventListeners()
  // but shown here for clarity on the integration pattern

  if (!presenter) return;

  // Broadcast metrics regularly
  const metricsInterval = setInterval(() => {
    const metrics = {
      budget: 10,
      spent: 2.5,
      pnl: 0.3,
      roi: 3.0,
      trades: 47,
      agents: 5,
      phase: 'TRADING',
      elapsed: '2:34',
    };
    swarmBroadcast.metrics(metrics);
  }, 2000);

  // Return cleanup function
  return () => {
    clearInterval(metricsInterval);
  };
}

/**
 * Example usage in a standalone script
 */
export async function runDashboardIntegratedDemo() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable required');
  }

  // Create formatter that broadcasts to dashboard
  const presenter = new DashboardIntegratedPresentation({
    openRouterApiKey: apiKey,
    audience: 'technical',
    presenterName: 'Demo System',
    hackathonName: 'Solana Hackathon 2026',
    projectName: 'Autonomous Memecoin Agent Swarm',
    durationMinutes: 5,
    budgetSol: 10,
  });

  // Start the presentation (events automatically broadcast to dashboard)
  const summary = await presenter.runPresentation();

  console.log('\n📋 Session Complete');
  console.log(`Duration: ${summary.metrics.duration}`);
  console.log(`Trades: ${summary.metrics.tradeCount}`);
  console.log(`Final P&L: ${summary.metrics.finalPnl.toFixed(2)} SOL`);
  console.log(`ROI: ${summary.metrics.roi.toFixed(1)}%`);
  console.log(`Highlights: ${summary.highlights.join(', ')}`);

  return summary;
}

/**
 * Client-side hook to display live updates
 * Usage: const monitor = useSwarmMonitor();
 * The hook will automatically connect to /api/swarm/events
 */
export function useSwarmMonitorIntegration() {
  // This connects to EventSource which receives broadcasts from swarmEventManager
  // See swarm/events/route.ts and hooks/useSwarmMonitor.ts for implementation
  return {
    connect: () => {
      // Connection handled by useSwarmMonitor hook
    },
    disconnect: () => {
      // Cleanup handled by hook cleanup
    },
  };
}

/**
 * Broadcast patterns for different events in PresentationMode
 */
export const broadcastPatterns = {
  // When initializing
  init: () => {
    swarmBroadcast.event(
      'init',
      '🚀 Starting autonomous AI agent swarm with 5 independent agents and 10 SOL budget'
    );
  },

  // When generating wallets
  wallets: () => {
    swarmBroadcast.walletGeneration(5);
  },

  // When making strategy decision
  strategy: () => {
    swarmBroadcast.strategyDecision(
      'Create new token on Pump.fun',
      0.87
    );
  },

  // When token is created
  tokenCreated: (mint: string, devBuy: number) => {
    swarmBroadcast.tokenCreated(mint, devBuy);
  },

  // When trade executes
  trade: (direction: string, amount: number, count: number) => {
    swarmBroadcast.trade(direction, amount, count);
  },

  // When token graduates
  graduated: (mint: string) => {
    swarmBroadcast.graduated(mint);
  },

  // Regular metrics broadcast
  metrics: (
    budget: number,
    spent: number,
    trades: number,
    pnl: number,
    elapsed: string
  ) => {
    swarmBroadcast.metrics({
      budget,
      spent,
      pnl,
      roi: (pnl / budget) * 100,
      trades,
      agents: 5,
      phase: 'TRADING',
      elapsed,
    });
  },

  // Error handling
  error: (message: string) => {
    swarmBroadcast.event('error', `❌ ${message}`);
  },
};

/**
 * Data flow diagram:
 *
 * PresentationMode (packages/pump-agent-swarm)
 *     ↓
 * swarmBroadcast.* calls
 *     ↓
 * swarmEventManager.broadcast*()
 *     ↓
 * GET /api/swarm/events (SSE)
 *     ↓
 * useSwarmMonitor hook
 *     ↓
 * SwarmMonitor component
 *     ↓
 * Browser display ✨
 */
