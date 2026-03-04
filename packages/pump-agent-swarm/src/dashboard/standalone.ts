/**
 * Standalone Dashboard Launcher
 *
 * Starts the dashboard HTTP server with a simulated orchestrator so you can
 * see the full UI without configuring wallets, RPC, or any Solana infra.
 *
 * Usage:  npx tsx src/dashboard/standalone.ts
 *
 * Once real config is set, the same DashboardServer class serves live data
 * from the SwarmOrchestrator — this file is only for previewing the interface.
 */

import { DashboardServer } from './server.js';
import type { SwarmOrchestrator } from './api-routes.js';

// ─── Simulated Orchestrator ──────────────────────────────────

const FAKE_MINT = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

interface SimulatedTrade {
  direction: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  agentId: string;
}

const AGENT_IDS = [
  'trader-alpha-01', 'trader-beta-02', 'trader-gamma-03',
  'volume-agent-01', 'volume-agent-02',
  'market-maker-01', 'market-maker-02',
  'accumulator-01',
  'exit-agent-01',
  'sniper-01',
  'creator-01',
  'sentinel-01',
];

const AGENT_TYPES: Record<string, string> = {
  'trader-alpha-01': 'trader', 'trader-beta-02': 'trader', 'trader-gamma-03': 'trader',
  'volume-agent-01': 'volume', 'volume-agent-02': 'volume',
  'market-maker-01': 'market-maker', 'market-maker-02': 'market-maker',
  'accumulator-01': 'accumulator',
  'exit-agent-01': 'exit',
  'sniper-01': 'sniper',
  'creator-01': 'creator',
  'sentinel-01': 'sentinel',
};

class SimulatedOrchestrator implements SwarmOrchestrator {
  private startedAt = Date.now();
  private phase = 'trading';
  private trades: SimulatedTrade[] = [];
  private paused = false;

  getPhase(): string { return this.paused ? 'paused' : this.phase; }
  getStartedAt(): number | null { return this.startedAt; }
  getTokenMint(): string | null { return FAKE_MINT; }
  getAgentCount(): number { return 12; }
  getActiveAgentCount(): number { return this.paused ? 0 : 10; }
  getTotalTrades(): number { return this.trades.length; }
  getTotalVolumeSol(): number {
    return this.trades.reduce((sum, t) => sum + t.solAmount, 0);
  }
  getCurrentPnl(): number {
    return this.trades.reduce((sum, t) => {
      return sum + (t.direction === 'sell' ? t.solAmount * 0.03 : -t.solAmount * 0.01);
    }, 0);
  }
  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  triggerExit(): void { this.phase = 'exiting'; }
  emergencyStop(): void { this.phase = 'stopped'; this.paused = true; }

  addTrade(trade: SimulatedTrade): void {
    this.trades.push(trade);
  }

  getAgentSummaries(): Array<{ id: string; type: string; pnl: number; status: string }> {
    return AGENT_IDS.map((id) => ({
      id,
      type: AGENT_TYPES[id] ?? 'unknown',
      pnl: (Math.random() - 0.4) * 0.5,
      status: this.paused ? 'paused' : 'active',
    }));
  }
}

function generateTrade(orchestrator: SimulatedOrchestrator): void {
  const agent = AGENT_IDS[Math.floor(Math.random() * 8)];
  const direction: 'buy' | 'sell' = Math.random() > 0.45 ? 'buy' : 'sell';
  const basePrice = 0.00000142 + (Math.random() - 0.5) * 0.0000001;
  const solAmount = 0.01 + Math.random() * 0.5;
  const tokenAmount = solAmount / basePrice;

  orchestrator.addTrade({
    direction,
    solAmount: Math.round(solAmount * 10000) / 10000,
    tokenAmount: Math.round(tokenAmount),
    price: basePrice,
    timestamp: Date.now(),
    agentId: agent,
  });
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const port = parseInt(process.env['DASHBOARD_PORT'] ?? '3847', 10);
  const orchestrator = new SimulatedOrchestrator();

  // Seed initial trades
  for (let i = 0; i < 25; i++) {
    generateTrade(orchestrator);
  }

  // Create dashboard server (serves inline HTML at /)
  const server = new DashboardServer({ port, hostname: '0.0.0.0', corsEnabled: true, websocketEnabled: true });

  // Attach orchestrator WITHOUT full DashboardContext — the inline HTML
  // dashboard only needs /api/status, /api/agents, /api/pnl which we add below.
  server.attachOrchestrator(orchestrator);

  // Add the 3 lightweight API endpoints the inline dashboard fetches
  const app = server.getApp();

  app.get('/api/status', (c) => {
    return c.json({
      success: true,
      data: {
        phase: orchestrator.getPhase(),
        totalAgents: orchestrator.getAgentCount(),
        activeAgents: orchestrator.getActiveAgentCount(),
        totalTrades: orchestrator.getTotalTrades(),
        totalVolumeSol: orchestrator.getTotalVolumeSol(),
        uptime: Date.now() - (orchestrator.getStartedAt() ?? Date.now()),
        tokenMint: orchestrator.getTokenMint(),
      },
      timestamp: Date.now(),
    });
  });

  app.get('/api/agents', (c) => {
    return c.json({
      success: true,
      data: orchestrator.getAgentSummaries(),
      timestamp: Date.now(),
    });
  });

  app.get('/api/pnl', (c) => {
    const pnl = orchestrator.getCurrentPnl();
    return c.json({
      success: true,
      data: {
        snapshot: {
          total: pnl,
          realized: pnl * 0.7,
          unrealized: pnl * 0.3,
          roi: 0.05 + Math.random() * 0.02,
          maxDrawdown: 0.02 + Math.random() * 0.01,
        },
      },
      timestamp: Date.now(),
    });
  });

  await server.start();

  // Generate trades every 1-4 seconds to simulate live activity
  setInterval(() => {
    if (orchestrator.getPhase() === 'trading') {
      generateTrade(orchestrator);
    }
  }, 1500 + Math.random() * 2500);

  console.log('');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║                                                      ║');
  console.log(`  ║   Pump Agent Swarm Dashboard                         ║`);
  console.log(`  ║   http://localhost:${port}                            ║`);
  console.log('  ║                                                      ║');
  console.log('  ║   Status: Running with simulated data                ║');
  console.log(`  ║   Token:  ${FAKE_MINT.slice(0, 20)}...               ║`);
  console.log(`  ║   Agents: ${AGENT_IDS.length} active                              ║`);
  console.log('  ║                                                      ║');
  console.log('  ║   Press Ctrl+C to stop                               ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch((err) => {
  console.error('Failed to start dashboard:', err);
  process.exit(1);
});
