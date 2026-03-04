/**
 * Standalone Dashboard Launcher
 *
 * Starts the dashboard HTTP server with a simulated orchestrator so you can
 * see the full UI without configuring wallets, RPC, or any Solana infra.
 *
 * Usage:  npx tsx src/dashboard/standalone.ts
 *
 * Once real config is set, the same dashboard serves live data from the
 * SwarmOrchestrator — this file is only for previewing the interface.
 */

import { DashboardServer } from './server.js';
import { registerApiRoutes, type DashboardContext, type SwarmOrchestrator } from './api-routes.js';
import { AgentMonitor } from './agent-monitor.js';
import { PnLDashboard } from './pnl-dashboard.js';
import { EventTimeline } from './event-timeline.js';
import { ExportManager } from './export-manager.js';
import { TradeVisualizer } from './trade-visualizer.js';
import { SupplyChart } from './supply-chart.js';
import { AlertManager } from './alert-manager.js';

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

  getTrades(): SimulatedTrade[] { return this.trades; }
}

// ─── Simulated Trade Generator ───────────────────────────────

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

function generateTrade(orchestrator: SimulatedOrchestrator): void {
  const agent = AGENT_IDS[Math.floor(Math.random() * 8)]; // first 8 are trading agents
  const direction: 'buy' | 'sell' = Math.random() > 0.45 ? 'buy' : 'sell';
  const basePrice = 0.00000142 + (Math.random() - 0.5) * 0.0000001;
  const solAmount = 0.01 + Math.random() * 0.5;
  const tokenAmount = solAmount / basePrice;

  const trade: SimulatedTrade = {
    direction,
    solAmount: Math.round(solAmount * 10000) / 10000,
    tokenAmount: Math.round(tokenAmount),
    price: basePrice,
    timestamp: Date.now(),
    agentId: agent,
  };

  orchestrator.addTrade(trade);
}

// ─── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const port = parseInt(process.env['DASHBOARD_PORT'] ?? '3847', 10);
  const orchestrator = new SimulatedOrchestrator();

  // Seed some initial trades
  for (let i = 0; i < 25; i++) {
    generateTrade(orchestrator);
  }

  // Create dashboard components
  const agentMonitor = new AgentMonitor();
  const pnlDashboard = new PnLDashboard();
  const eventTimeline = new EventTimeline();
  const tradeVisualizer = new TradeVisualizer();
  const supplyChart = new SupplyChart();
  const alertManager = new AlertManager();
  const exportManager = new ExportManager({
    tradeVisualizer: {
      getTradeHistory: () => ({
        trades: orchestrator.getTrades().map((t, i) => ({
          id: `trade-${i}`,
          timestamp: t.timestamp,
          agentId: t.agentId,
          direction: t.direction,
          solAmount: t.solAmount,
          tokenAmount: t.tokenAmount,
          price: t.price,
          signature: `sig-${i}`,
          slippage: 0.01,
          fees: 0.000005,
        })),
        total: orchestrator.getTrades().length,
        hasMore: false,
      }),
      getTradeFlow: () => ({ nodes: [], links: [] }),
    },
    pnlDashboard: {
      getTimeSeries: () => ({ points: [], startTime: Date.now() - 3600000, endTime: Date.now() }),
      getSnapshot: () => ({
        total: orchestrator.getCurrentPnl(),
        realized: orchestrator.getCurrentPnl() * 0.7,
        unrealized: orchestrator.getCurrentPnl() * 0.3,
        roi: 0.05,
        maxDrawdown: 0.02,
        sharpeRatio: 1.2,
        timestamp: Date.now(),
      }),
    },
  });

  // Register agents with the monitor
  for (const agentId of AGENT_IDS) {
    agentMonitor.register({
      id: agentId,
      type: AGENT_TYPES[agentId] ?? 'unknown',
      wallet: `wallet-${agentId.slice(-2)}`,
    });
  }

  // Build dashboard context
  const context: DashboardContext = {
    orchestrator,
    agentMonitor,
    pnlDashboard,
    eventTimeline,
    tradeVisualizer,
    supplyChart,
    alertManager,
    exportManager,
    configManager: null as unknown as DashboardContext['configManager'],
    auditLogger: null as unknown as DashboardContext['auditLogger'],
    healthMonitor: null as unknown as DashboardContext['healthMonitor'],
  };

  // Create and start server
  const server = new DashboardServer({ port, hostname: '0.0.0.0', corsEnabled: true, websocketEnabled: true });
  server.attachOrchestrator(orchestrator, context);
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
  console.log(`  ║   🐝 Pump Agent Swarm Dashboard                      ║`);
  console.log(`  ║   http://localhost:${port}                            ║`);
  console.log('  ║                                                      ║');
  console.log('  ║   Status: Running with simulated data                ║');
  console.log(`  ║   Token:  ${FAKE_MINT.slice(0, 20)}...               ║`);
  console.log(`  ║   Agents: ${AGENT_IDS.length} active                              ║`);
  console.log('  ║                                                      ║');
  console.log('  ║   API Endpoints:                                     ║');
  console.log(`  ║     GET  /api/status    — Swarm status               ║`);
  console.log(`  ║     GET  /api/agents    — Agent list                 ║`);
  console.log(`  ║     GET  /api/pnl       — P&L snapshot               ║`);
  console.log(`  ║     GET  /api/trades    — Trade history              ║`);
  console.log(`  ║     GET  /api/health    — Health check               ║`);
  console.log(`  ║     WS   /ws           — Real-time events            ║`);
  console.log('  ║                                                      ║');
  console.log('  ║   Press Ctrl+C to stop                               ║');
  console.log('  ╚══════════════════════════════════════════════════════╝');
  console.log('');
}

main().catch((err) => {
  console.error('Failed to start dashboard:', err);
  process.exit(1);
});
