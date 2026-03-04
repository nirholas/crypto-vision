/**
 * Dashboard Server — Hono-based HTTP server for live swarm monitoring
 *
 * Features:
 * - REST API endpoints for swarm status, agents, trades, P&L, and configuration
 * - WebSocket endpoint at /ws for real-time event streaming
 * - Inline HTML dashboard served at GET / (dark theme, auto-reconnecting WebSocket)
 * - CORS middleware, request logging, optional API key auth, error handling
 * - Factory function for quick setup with sensible defaults
 */

import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { registerApiRoutes, type DashboardContext, type SwarmOrchestrator } from './api-routes.js';
import { SwarmLogger } from '../infra/logger.js';
import { SwarmEventBus } from '../infra/event-bus.js';

// ─── Configuration ────────────────────────────────────────────

export interface DashboardServerConfig {
  /** Port to listen on */
  port: number;
  /** Hostname to bind to (default: '0.0.0.0') */
  hostname: string;
  /** Enable CORS for all origins (default: true for demo) */
  corsEnabled: boolean;
  /** Enable WebSocket support (default: true) */
  websocketEnabled: boolean;
  /** Static assets directory (optional) */
  staticDir?: string;
  /** API key for authenticated endpoints (optional) */
  apiKey?: string;
}

const DEFAULT_CONFIG: DashboardServerConfig = {
  port: 3847,
  hostname: '0.0.0.0',
  corsEnabled: true,
  websocketEnabled: true,
};

// ─── WebSocket Connection Tracker ─────────────────────────────

interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  connectedAt: number;
  lastPing: number;
  subscriptions: Set<string>;
}

// ─── Inline HTML Dashboard ────────────────────────────────────

function buildDashboardHtml(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pump Agent Swarm — Live Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: #0a0a0f; color: #e0e0e0; min-height: 100vh; }
  header { background: #111118; padding: 12px 24px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #222; }
  header h1 { font-size: 18px; color: #00ff88; }
  .ws-status { font-size: 12px; padding: 3px 10px; border-radius: 20px; }
  .ws-connected { background: #00ff8822; color: #00ff88; }
  .ws-disconnected { background: #ff444422; color: #ff4444; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; padding: 16px; }
  .card { background: #14141e; border: 1px solid #222; border-radius: 8px; padding: 16px; }
  .card h2 { font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1a1a25; }
  .stat-label { color: #666; }
  .stat-value { color: #e0e0e0; font-weight: bold; }
  .pnl-positive { color: #00ff88; }
  .pnl-negative { color: #ff4444; }
  .phase { color: #ffaa00; font-weight: bold; font-size: 20px; padding: 8px 0; }
  .agent-item { padding: 8px; border-bottom: 1px solid #1a1a25; display: flex; justify-content: space-between; align-items: center; }
  .agent-type { padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #ffffff11; color: #aaa; }
  .trade-item { padding: 6px 0; border-bottom: 1px solid #1a1a25; font-size: 13px; display: flex; gap: 8px; align-items: center; }
  .trade-buy { color: #00ff88; }
  .trade-sell { color: #ff4444; }
  .trade-time { color: #555; font-size: 11px; min-width: 80px; }
  #trades-feed { max-height: 360px; overflow-y: auto; }
  #agents-list { max-height: 320px; overflow-y: auto; }
  .empty { color: #444; font-style: italic; padding: 20px; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>&#x1F41D; Pump Agent Swarm</h1>
  <span id="ws-badge" class="ws-status ws-disconnected">disconnected</span>
  <span style="margin-left:auto; font-size:12px; color:#555;">live dashboard</span>
</header>
<div class="grid">
  <div class="card">
    <h2>Swarm Status</h2>
    <div id="phase" class="phase">—</div>
    <div id="status-stats"></div>
  </div>
  <div class="card">
    <h2>P&amp;L</h2>
    <div id="pnl-stats"></div>
  </div>
  <div class="card" style="grid-column: span 1;">
    <h2>Agents</h2>
    <div id="agents-list"><div class="empty">waiting for data…</div></div>
  </div>
  <div class="card" style="grid-column: span 1;">
    <h2>Live Trade Feed</h2>
    <div id="trades-feed"><div class="empty">waiting for trades…</div></div>
  </div>
</div>
<script>
(function(){
  const host = location.host;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let ws;
  let reconnectTimer;
  const badge = document.getElementById('ws-badge');
  const phaseEl = document.getElementById('phase');
  const statusStats = document.getElementById('status-stats');
  const pnlStats = document.getElementById('pnl-stats');
  const agentsList = document.getElementById('agents-list');
  const tradesFeed = document.getElementById('trades-feed');

  function connect() {
    ws = new WebSocket(proto + '://' + host + '/ws');
    ws.onopen = function() {
      badge.textContent = 'connected';
      badge.className = 'ws-status ws-connected';
      clearTimeout(reconnectTimer);
      fetchInitialData();
    };
    ws.onclose = function() {
      badge.textContent = 'disconnected';
      badge.className = 'ws-status ws-disconnected';
      reconnectTimer = setTimeout(connect, 2000);
    };
    ws.onerror = function() { ws.close(); };
    ws.onmessage = function(ev) {
      try {
        var msg = JSON.parse(ev.data);
        handleMessage(msg);
      } catch(e) { /* ignore malformed */ }
    };
  }

  function fetchInitialData() {
    fetch('/api/status').then(r=>r.json()).then(d=>{
      if(d.success) renderStatus(d.data);
    }).catch(()=>{});
    fetch('/api/agents').then(r=>r.json()).then(d=>{
      if(d.success) renderAgents(d.data);
    }).catch(()=>{});
    fetch('/api/pnl').then(r=>r.json()).then(d=>{
      if(d.success) renderPnl(d.data);
    }).catch(()=>{});
  }

  function handleMessage(msg) {
    if (msg.type === 'status') renderStatus(msg.data);
    else if (msg.type === 'agents') renderAgents(msg.data);
    else if (msg.type === 'pnl') renderPnl(msg.data);
    else if (msg.type === 'trade') appendTrade(msg.data);
    else if (msg.type === 'event') appendEvent(msg.data);
  }

  function renderStatus(s) {
    phaseEl.textContent = s.phase || '—';
    statusStats.innerHTML =
      statRow('Total Agents', s.totalAgents) +
      statRow('Active', s.activeAgents) +
      statRow('Trades', s.totalTrades) +
      statRow('Volume (SOL)', (s.totalVolumeSol||0).toFixed(2)) +
      statRow('Uptime', formatDuration(s.uptime||0));
  }

  function renderPnl(p) {
    var snapshot = p.snapshot || p;
    var total = snapshot.total || snapshot.currentPnl || 0;
    var cls = total >= 0 ? 'pnl-positive' : 'pnl-negative';
    pnlStats.innerHTML =
      '<div style="font-size:28px;font-weight:bold;padding:8px 0;" class="'+cls+'">' + total.toFixed(4) + ' SOL</div>' +
      statRow('Realized', (snapshot.realized||0).toFixed(4)) +
      statRow('Unrealized', (snapshot.unrealized||0).toFixed(4)) +
      statRow('ROI', ((snapshot.roi||0)*100).toFixed(2)+'%') +
      statRow('Drawdown', ((snapshot.maxDrawdown||0)*100).toFixed(2)+'%');
  }

  function renderAgents(agents) {
    if(!agents || !agents.length) { agentsList.innerHTML = '<div class="empty">no agents</div>'; return; }
    agentsList.innerHTML = agents.map(function(a) {
      var pnlCls = (a.pnl||0) >= 0 ? 'pnl-positive' : 'pnl-negative';
      return '<div class="agent-item"><span>' + a.id.slice(0,8) + ' <span class="agent-type">' + a.type + '</span></span>' +
        '<span class="'+pnlCls+'">' + (a.pnl||0).toFixed(4) + ' SOL</span></div>';
    }).join('');
  }

  function appendTrade(t) {
    if(tradesFeed.querySelector('.empty')) tradesFeed.innerHTML = '';
    var cls = t.direction === 'buy' ? 'trade-buy' : 'trade-sell';
    var el = document.createElement('div');
    el.className = 'trade-item';
    el.innerHTML = '<span class="trade-time">' + new Date(t.timestamp).toLocaleTimeString() + '</span>' +
      '<span class="'+cls+'">' + t.direction.toUpperCase() + '</span>' +
      '<span>' + (t.solAmount||0).toFixed(4) + ' SOL</span>' +
      '<span style="color:#555;">@</span>' +
      '<span>' + (t.price||0).toFixed(8) + '</span>';
    tradesFeed.prepend(el);
    while(tradesFeed.children.length > 100) tradesFeed.removeChild(tradesFeed.lastChild);
  }

  function appendEvent(e) { /* events rendered as trades for now */ }

  function statRow(label, value) {
    return '<div class="stat-row"><span class="stat-label">'+label+'</span><span class="stat-value">'+value+'</span></div>';
  }

  function formatDuration(ms) {
    var s = Math.floor(ms/1000);
    var m = Math.floor(s/60); s %= 60;
    var h = Math.floor(m/60); m %= 60;
    return h+'h '+m+'m '+s+'s';
  }

  connect();
})();
</script>
</body>
</html>`;
}

// ─── Dashboard Server ─────────────────────────────────────────

export class DashboardServer {
  private readonly config: DashboardServerConfig;
  private readonly app: Hono;
  private readonly logger: SwarmLogger;
  private readonly eventBus: SwarmEventBus;
  private readonly connections: Map<string, WebSocketConnection> = new Map();
  private orchestrator: SwarmOrchestrator | null = null;
  private dashboardContext: DashboardContext | null = null;
  private server: HttpServer | null = null;
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;
  private connectionCounter = 0;

  constructor(config: Partial<DashboardServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.app = new Hono();
    this.logger = SwarmLogger.create('dashboard-server', 'system');
    this.eventBus = SwarmEventBus.getInstance();

    this.setupMiddleware();
    this.setupDashboardRoute();
    this.setupHealthRoute();
  }

  /**
   * Attach the SwarmOrchestrator and full DashboardContext for data access.
   * Must be called before `start()` to enable API routes and WebSocket data.
   */
  attachOrchestrator(orchestrator: SwarmOrchestrator, context?: DashboardContext): void {
    this.orchestrator = orchestrator;

    if (context) {
      this.dashboardContext = context;
      registerApiRoutes(this.app, context);
      this.logger.info('API routes registered with full dashboard context');
    } else {
      this.logger.warn('Orchestrator attached without full context — API routes not registered');
    }
  }

  /**
   * Start the HTTP server on the configured port.
   */
  async start(): Promise<void> {
    if (this.server) {
      this.logger.warn('Server already running');
      return;
    }

    if (this.config.websocketEnabled) {
      this.setupWebSocketRoute();
      this.startBroadcastLoop();
    }

    return new Promise<void>((resolve) => {
      this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        try {
          const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value !== undefined) {
              headers.set(key, Array.isArray(value) ? value.join(', ') : value);
            }
          }

          const body =
            req.method !== 'GET' && req.method !== 'HEAD'
              ? await new Promise<string>((resolveBody) => {
                  const chunks: Buffer[] = [];
                  req.on('data', (chunk: Buffer) => chunks.push(chunk));
                  req.on('end', () => resolveBody(Buffer.concat(chunks).toString()));
                })
              : undefined;

          const request = new Request(url.toString(), {
            method: req.method ?? 'GET',
            headers,
            body,
          });

          const response = await this.app.fetch(request);

          res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
          const arrayBuffer = await response.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, data: null, error: 'Internal server error', timestamp: Date.now() }));
        }
      });

      this.server.listen(this.config.port, this.config.hostname, () => {
        this.logger.info('Dashboard server started', {
          port: this.config.port,
          hostname: this.config.hostname,
          cors: this.config.corsEnabled,
          websocket: this.config.websocketEnabled,
        });
        resolve();
      });
    });
  }

  /**
   * Gracefully shut down the server and close all WebSocket connections.
   */
  async stop(): Promise<void> {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    for (const [id, conn] of this.connections) {
      try {
        conn.ws.close(1001, 'Server shutting down');
      } catch {
        // Already closed — ignore
      }
      this.connections.delete(id);
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
      this.logger.info('Dashboard server stopped');
    }
  }

  /**
   * Return the Hono app instance for testing or external mounting.
   */
  getApp(): Hono {
    return this.app;
  }

  /**
   * Return the server port (useful after start).
   */
  getPort(): number {
    return this.config.port;
  }

  /**
   * Get current WebSocket connection count.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  // ── Middleware ──────────────────────────────────────────────

  private setupMiddleware(): void {
    // CORS
    if (this.config.corsEnabled) {
      this.app.use(
        '*',
        cors({
          origin: '*',
          allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
          maxAge: 86400,
        }),
      );
    }

    // Request logging
    this.app.use('*', async (c, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;
      const method = c.req.method;
      const path = c.req.path;
      const status = c.res.status;

      if (path !== '/health' && path !== '/ws') {
        this.logger.debug(`${method} ${path} ${status} ${duration}ms`);
      }
    });

    // Optional API key authentication for write endpoints
    if (this.config.apiKey) {
      this.app.use('/api/*', async (c, next) => {
        const method = c.req.method;
        if (method === 'PUT' || method === 'POST' || method === 'DELETE') {
          const apiKey =
            c.req.header('X-API-Key') ??
            c.req.header('Authorization')?.replace('Bearer ', '');

          if (apiKey !== this.config.apiKey) {
            return c.json(
              { success: false, data: null, timestamp: Date.now(), error: 'Unauthorized — invalid API key' },
              401,
            );
          }
        }
        await next();
      });
    }

    // Global error handler
    this.app.onError((err, c) => {
      this.logger.error('Unhandled request error', err, {
        method: c.req.method,
        path: c.req.path,
      });
      return c.json(
        { success: false, data: null, timestamp: Date.now(), error: err.message || 'Internal server error' },
        500,
      );
    });
  }

  // ── Routes ─────────────────────────────────────────────────

  private setupDashboardRoute(): void {
    this.app.get('/', (c) => {
      const html = buildDashboardHtml(this.config.port);
      return c.html(html);
    });
  }

  private setupHealthRoute(): void {
    this.app.get('/health', (c) => {
      const uptime = process.uptime() * 1000;
      return c.json({
        success: true,
        data: {
          status: 'ok',
          uptime,
          connections: this.connections.size,
          orchestratorAttached: this.orchestrator !== null,
          apiRoutesRegistered: this.dashboardContext !== null,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });
    });
  }

  // ── WebSocket ──────────────────────────────────────────────

  private setupWebSocketRoute(): void {
    // Hono upgrade endpoint — uses the standard Web API pattern
    this.app.get('/ws', (c) => {
      const upgradeHeader = c.req.header('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return c.json(
          { success: false, data: null, timestamp: Date.now(), error: 'Expected WebSocket upgrade' },
          426,
        );
      }

      // In Node.js with @hono/node-server, WebSocket upgrades need
      // to be handled at the raw HTTP level. Return a placeholder
      // response — the actual upgrade is handled by the server adapter.
      return c.text('WebSocket endpoint — upgrade required', 426);
    });

    // Subscribe to event bus for broadcasting
    this.eventBus.subscribe('*', (event) => {
      this.broadcastEvent(event);
    });
  }

  /**
   * Handle a raw WebSocket connection (called from server upgrade hook).
   */
  handleWebSocketUpgrade(ws: WebSocket): void {
    this.connectionCounter += 1;
    const connId = `ws-${this.connectionCounter}-${Date.now()}`;

    const connection: WebSocketConnection = {
      id: connId,
      ws,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      subscriptions: new Set(['*']),
    };

    this.connections.set(connId, connection);
    this.logger.info('WebSocket client connected', { connId, total: this.connections.size });

    // Send initial state snapshot
    this.sendInitialSnapshot(connection);

    ws.addEventListener('message', (event) => {
      try {
        const data = typeof event.data === 'string' ? event.data : '';
        const msg = JSON.parse(data) as { type: string; payload?: unknown };
        this.handleClientMessage(connection, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.addEventListener('close', () => {
      this.connections.delete(connId);
      this.logger.info('WebSocket client disconnected', { connId, total: this.connections.size });
    });

    ws.addEventListener('error', () => {
      this.connections.delete(connId);
    });
  }

  private handleClientMessage(conn: WebSocketConnection, msg: { type: string; payload?: unknown }): void {
    switch (msg.type) {
      case 'ping':
        conn.lastPing = Date.now();
        this.sendToConnection(conn, { type: 'pong', timestamp: Date.now() });
        break;

      case 'subscribe':
        if (typeof msg.payload === 'string') {
          conn.subscriptions.add(msg.payload);
        }
        break;

      case 'unsubscribe':
        if (typeof msg.payload === 'string') {
          conn.subscriptions.delete(msg.payload);
        }
        break;

      default:
        break;
    }
  }

  private sendInitialSnapshot(conn: WebSocketConnection): void {
    if (!this.orchestrator) return;

    // Send status
    const status = {
      phase: this.orchestrator.getPhase(),
      uptime: this.orchestrator.getStartedAt()
        ? Date.now() - (this.orchestrator.getStartedAt() ?? 0)
        : 0,
      tokenMint: this.orchestrator.getTokenMint(),
      totalAgents: this.orchestrator.getAgentCount(),
      activeAgents: this.orchestrator.getActiveAgentCount(),
      totalTrades: this.orchestrator.getTotalTrades(),
      totalVolumeSol: this.orchestrator.getTotalVolumeSol(),
      currentPnl: this.orchestrator.getCurrentPnl(),
      startedAt: this.orchestrator.getStartedAt(),
    };

    this.sendToConnection(conn, { type: 'status', data: status });
  }

  private broadcastEvent(event: { type: string; category: string; payload: Record<string, unknown> }): void {
    const message = this.transformEventToMessage(event);
    if (!message) return;

    for (const conn of this.connections.values()) {
      if (conn.subscriptions.has('*') || conn.subscriptions.has(event.category)) {
        this.sendToConnection(conn, message);
      }
    }
  }

  private transformEventToMessage(
    event: { type: string; category: string; payload: Record<string, unknown> },
  ): Record<string, unknown> | null {
    const category = event.category;

    if (category === 'trading') {
      return {
        type: 'trade',
        data: {
          direction: event.payload['direction'] ?? 'unknown',
          solAmount: event.payload['solAmount'] ?? 0,
          tokenAmount: event.payload['tokenAmount'] ?? 0,
          price: event.payload['price'] ?? 0,
          timestamp: event.payload['timestamp'] ?? Date.now(),
          agentId: event.payload['agentId'] ?? 'unknown',
          signature: event.payload['signature'] ?? '',
        },
      };
    }

    if (category === 'phase') {
      return {
        type: 'event',
        data: {
          title: event.type,
          category,
          timestamp: Date.now(),
          ...event.payload,
        },
      };
    }

    return {
      type: 'event',
      data: {
        title: event.type,
        category,
        timestamp: Date.now(),
      },
    };
  }

  private startBroadcastLoop(): void {
    // Periodic status broadcast every 2 seconds
    this.broadcastInterval = setInterval(() => {
      if (!this.orchestrator || this.connections.size === 0) return;

      const status = {
        phase: this.orchestrator.getPhase(),
        uptime: this.orchestrator.getStartedAt()
          ? Date.now() - (this.orchestrator.getStartedAt() ?? 0)
          : 0,
        tokenMint: this.orchestrator.getTokenMint(),
        totalAgents: this.orchestrator.getAgentCount(),
        activeAgents: this.orchestrator.getActiveAgentCount(),
        totalTrades: this.orchestrator.getTotalTrades(),
        totalVolumeSol: this.orchestrator.getTotalVolumeSol(),
        currentPnl: this.orchestrator.getCurrentPnl(),
        startedAt: this.orchestrator.getStartedAt(),
      };

      const message = { type: 'status', data: status };

      for (const conn of this.connections.values()) {
        this.sendToConnection(conn, message);
      }
    }, 2000);
  }

  private sendToConnection(conn: WebSocketConnection, message: Record<string, unknown>): void {
    try {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(JSON.stringify(message));
      }
    } catch {
      // Connection gone — will be cleaned up on close event
      this.connections.delete(conn.id);
    }
  }
}

// ─── Factory Function ─────────────────────────────────────────

/**
 * Create and configure a DashboardServer with sensible defaults.
 *
 * @param orchestrator - SwarmOrchestrator instance for swarm data
 * @param config       - Optional partial config overrides
 * @param context      - Optional full DashboardContext for API routes
 * @returns Configured DashboardServer ready to start()
 */
export function createDashboardServer(
  orchestrator: SwarmOrchestrator,
  config?: Partial<DashboardServerConfig>,
  context?: DashboardContext,
): DashboardServer {
  const server = new DashboardServer(config);
  server.attachOrchestrator(orchestrator, context);
  return server;
}
