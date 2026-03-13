/**
 * Network Flow Visualization — Real-Time Animated Trade Router
 *
 * Canvas-based particle animation showing smart money trades flowing
 * through a network graph of wallet → token → exchange nodes.
 *
 * Each incoming trade spawns an animated particle that travels along
 * a bezier path from source to destination, with:
 * - Green particles for buys, red for sells
 * - Node pulse/glow on particle arrival
 * - Trade details tooltip on hover
 * - Configurable chain filter (SOL / BSC / All)
 */

'use client';

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Radio, Pause, Play, Maximize2, Filter } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface NetworkNode {
  id: string;
  label: string;
  type: 'wallet' | 'exchange' | 'token' | 'dex';
  x: number;
  y: number;
  radius: number;
  color: string;
  glow: number; // 0–1, decays over time
  txCount: number;
  chain?: string;
  avatar?: string;
}

interface Particle {
  id: string;
  sourceId: string;
  targetId: string;
  progress: number; // 0–1
  speed: number;
  color: string;
  size: number;
  action: 'buy' | 'sell' | 'transfer';
  label: string;
  amount: string;
  token: string;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

interface TradeEvent {
  id: string;
  walletLabel: string;
  walletAddress: string;
  token: string;
  tokenAddress: string;
  action: 'buy' | 'sell' | 'transfer';
  amount: number;
  amountUsd: number;
  chain: 'sol' | 'bsc';
  timestamp: number;
  exchange?: string;
}

// ─── Constants ──────────────────────────────────────────────

const COLORS = {
  buy: '#16C784',
  sell: '#EA3943',
  transfer: '#3861FB',
  wallet: '#F7931A',
  exchange: '#8DC647',
  token: '#3861FB',
  dex: '#9333EA',
  bg: '#0D1421',
  grid: 'rgba(43, 53, 68, 0.3)',
  text: '#A6B0C3',
  textBright: '#FFFFFF',
  border: '#2B3544',
  glow: {
    buy: 'rgba(22, 199, 132, 0.4)',
    sell: 'rgba(234, 57, 67, 0.4)',
  },
};

const NODE_TYPES: Record<string, { emoji: string; color: string }> = {
  wallet: { emoji: '👛', color: COLORS.wallet },
  exchange: { emoji: '🏦', color: COLORS.exchange },
  token: { emoji: '🪙', color: COLORS.token },
  dex: { emoji: '🔄', color: COLORS.dex },
};

// ─── Node Layout Presets ────────────────────────────────────

type NodeSeed = Pick<NetworkNode, 'id' | 'label' | 'type'> & { chain?: string; x?: number; y?: number };

function createNetworkNodes(width: number, height: number): NetworkNode[] {
  const cx = width / 2;
  const cy = height / 2;

  // Hub-and-spoke layout: tokens in center ring, wallets on left, exchanges on right
  const wallets: NodeSeed[] = [
    { id: 'w-smart-degen', label: 'Smart Degen', type: 'wallet', chain: 'multi' },
    { id: 'w-kol', label: 'KOL', type: 'wallet', chain: 'multi' },
    { id: 'w-sniper', label: 'Sniper Bot', type: 'wallet', chain: 'multi' },
    { id: 'w-fresh', label: 'Fresh Wallet', type: 'wallet', chain: 'multi' },
    { id: 'w-whale', label: 'Whale', type: 'wallet', chain: 'multi' },
    { id: 'w-launchpad', label: 'Launchpad SM', type: 'wallet', chain: 'multi' },
    { id: 'w-top-dev', label: 'Top Dev', type: 'wallet', chain: 'multi' },
  ];

  const tokenSeeds: NodeSeed[] = [
    { id: 't-sol', label: 'SOL', type: 'token' },
    { id: 't-bnb', label: 'BNB', type: 'token' },
    { id: 't-memecoin', label: 'Memecoins', type: 'token' },
    { id: 't-defi', label: 'DeFi', type: 'token' },
    { id: 't-new', label: 'New Launches', type: 'token' },
  ];

  const exchanges: NodeSeed[] = [
    { id: 'e-raydium', label: 'Raydium', type: 'dex' },
    { id: 'e-pancake', label: 'PancakeSwap', type: 'dex' },
    { id: 'e-jupiter', label: 'Jupiter', type: 'dex' },
    { id: 'e-binance', label: 'Binance', type: 'exchange' },
    { id: 'e-bybit', label: 'Bybit', type: 'exchange' },
  ];

  // Position wallets on the left arc
  const walletStartAngle = -Math.PI * 0.6;
  const walletEndAngle = Math.PI * 0.6;
  const walletRadius = Math.min(width, height) * 0.38;

  wallets.forEach((w, i) => {
    const angle = walletStartAngle + (walletEndAngle - walletStartAngle) * (i / (wallets.length - 1));
    w.x = cx - walletRadius * Math.cos(angle) * 0.6;
    w.y = cy + walletRadius * Math.sin(angle) * 0.8;
  });

  // Position tokens in center ring
  const tokenRadius = Math.min(width, height) * 0.15;
  tokenSeeds.forEach((t, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / tokenSeeds.length;
    t.x = cx + tokenRadius * Math.cos(angle);
    t.y = cy + tokenRadius * Math.sin(angle);
  });

  // Position exchanges on the right arc
  const exchStartAngle = -Math.PI * 0.5;
  const exchEndAngle = Math.PI * 0.5;
  const exchRadius = Math.min(width, height) * 0.38;

  exchanges.forEach((e, i) => {
    const angle = exchStartAngle + (exchEndAngle - exchStartAngle) * (i / (exchanges.length - 1));
    e.x = cx + exchRadius * Math.cos(angle) * 0.6;
    e.y = cy + exchRadius * Math.sin(angle) * 0.8;
  });

  const allNodes = [...wallets, ...tokenSeeds, ...exchanges];
  return allNodes.map((n) => ({
    id: n.id,
    label: n.label,
    type: n.type,
    chain: n.chain,
    radius: n.type === 'token' ? 24 : n.type === 'exchange' || n.type === 'dex' ? 22 : 20,
    color: NODE_TYPES[n.type]?.color ?? COLORS.text,
    glow: 0,
    txCount: 0,
    x: n.x ?? 0,
    y: n.y ?? 0,
  }));
}

// ─── Simulated Trade Generator ──────────────────────────────

function generateTrade(chain: 'sol' | 'bsc' | 'all'): TradeEvent {
  const chains = chain === 'all' ? (['sol', 'bsc'] as const) : [chain];
  const selectedChain = chains[Math.floor(Math.random() * chains.length)];

  const walletTypes = ['Smart Degen', 'KOL', 'Sniper Bot', 'Fresh Wallet', 'Whale', 'Launchpad SM', 'Top Dev'];
  const walletLabel = walletTypes[Math.floor(Math.random() * walletTypes.length)];
  const walletId = `w-${walletLabel.toLowerCase().replace(/\s+/g, '-')}`;

  const solTokens = ['SOL', 'BONK', 'WIF', 'JTO', 'PYTH', 'ORCA', 'RAY', 'SHEEP', 'BEECAT'];
  const bscTokens = ['BNB', 'CAKE', 'BAKE', 'XVS', 'BSW', 'SHEEP', 'BABYDOGE', 'FLOKI'];
  const tokenList = selectedChain === 'sol' ? solTokens : bscTokens;
  const token = tokenList[Math.floor(Math.random() * tokenList.length)];

  const action = Math.random() > 0.35 ? 'buy' : 'sell';
  const amountUsd =
    Math.random() < 0.3
      ? Math.random() * 500 + 50 // small trade
      : Math.random() < 0.7
        ? Math.random() * 5000 + 500 // medium trade
        : Math.random() * 50000 + 5000; // whale trade

  const exchanges = selectedChain === 'sol'
    ? ['Raydium', 'Jupiter']
    : ['PancakeSwap', 'Binance', 'Bybit'];
  const exchange = exchanges[Math.floor(Math.random() * exchanges.length)];

  const addr = selectedChain === 'sol'
    ? Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('')
    : '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    walletLabel,
    walletAddress: addr,
    token,
    tokenAddress: addr,
    action,
    amount: amountUsd / (Math.random() * 100 + 1),
    amountUsd,
    chain: selectedChain,
    timestamp: Date.now(),
    exchange,
  };
}

// ─── Resolve Node IDs ───────────────────────────────────────

function resolveSourceNode(trade: TradeEvent): string {
  const walletId = `w-${trade.walletLabel.toLowerCase().replace(/\s+/g, '-')}`;
  return walletId;
}

function resolveTargetNode(trade: TradeEvent): string {
  // Token node category
  const memecoins = ['BONK', 'WIF', 'SHEEP', 'BEECAT', 'BABYDOGE', 'FLOKI', 'BAKE'];
  const defiTokens = ['JTO', 'PYTH', 'ORCA', 'RAY', 'CAKE', 'XVS', 'BSW'];
  const native = ['SOL', 'BNB'];

  if (native.includes(trade.token)) return trade.token === 'SOL' ? 't-sol' : 't-bnb';
  if (memecoins.includes(trade.token)) return 't-memecoin';
  if (defiTokens.includes(trade.token)) return 't-defi';
  return 't-new';
}

function resolveExchangeNode(trade: TradeEvent): string {
  const map: Record<string, string> = {
    Raydium: 'e-raydium',
    Jupiter: 'e-jupiter',
    PancakeSwap: 'e-pancake',
    Binance: 'e-binance',
    Bybit: 'e-bybit',
  };
  return map[trade.exchange ?? ''] ?? 'e-raydium';
}

// ─── Bezier Math ────────────────────────────────────────────

function bezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const inv = 1 - t;
  return {
    x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
    y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y,
  };
}

function getControlPoint(
  src: { x: number; y: number },
  tgt: { x: number; y: number },
): { x: number; y: number } {
  const mx = (src.x + tgt.x) / 2;
  const my = (src.y + tgt.y) / 2;
  const dx = tgt.x - src.x;
  const dy = tgt.y - src.y;
  const offset = Math.sqrt(dx * dx + dy * dy) * 0.2;
  // Perpendicular offset for curved paths
  return {
    x: mx + (dy / Math.sqrt(dx * dx + dy * dy + 1)) * offset,
    y: my - (dx / Math.sqrt(dx * dx + dy * dy + 1)) * offset,
  };
}

// ─── Format ─────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// ─── Main Component ─────────────────────────────────────────

interface NetworkFlowVizProps {
  className?: string;
}

export function NetworkFlowViz({ className }: NetworkFlowVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<NetworkNode[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const recentTradesRef = useRef<TradeEvent[]>([]);
  const [playing, setPlaying] = useState(true);
  const [chainFilter, setChainFilter] = useState<'sol' | 'bsc' | 'all'>('all');
  const [stats, setStats] = useState({ totalTrades: 0, buys: 0, sells: 0, volume: 0 });
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const sizeRef = useRef({ w: 900, h: 600 });
  const [, forceRender] = useState(0);

  // Initialize nodes on mount / resize
  const initNodes = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const w = rect.width * (window.devicePixelRatio || 1);
    const h = Math.max(500, Math.min(700, rect.height)) * (window.devicePixelRatio || 1);
    sizeRef.current = { w: rect.width, h: Math.max(500, Math.min(700, rect.height)) };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${sizeRef.current.h}px`;
    }
    nodesRef.current = createNetworkNodes(sizeRef.current.w, sizeRef.current.h);
  }, []);

  // Spawn particle for a trade
  const spawnParticle = useCallback((trade: TradeEvent) => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    const sourceId = resolveSourceNode(trade);
    const tokenId = resolveTargetNode(trade);
    const exchangeId = resolveExchangeNode(trade);

    // Route: wallet → token → exchange (for buys)
    // Route: exchange → token → wallet (for sells)
    const isBuy = trade.action === 'buy';
    const baseSpeed = 0.008 + Math.random() * 0.006;
    const size = Math.min(6, 2 + Math.log10(trade.amountUsd + 1) * 0.8);

    // First leg: wallet ↔ token
    particlesRef.current.push({
      id: trade.id + '-1',
      sourceId: isBuy ? sourceId : exchangeId,
      targetId: tokenId,
      progress: 0,
      speed: baseSpeed,
      color: isBuy ? COLORS.buy : COLORS.sell,
      size,
      action: trade.action,
      label: trade.walletLabel,
      amount: fmtUsd(trade.amountUsd),
      token: trade.token,
      trail: [],
    });

    // Second leg: token ↔ exchange (spawns delayed via progress offset)
    particlesRef.current.push({
      id: trade.id + '-2',
      sourceId: tokenId,
      targetId: isBuy ? exchangeId : sourceId,
      progress: -0.5, // Delayed start
      speed: baseSpeed,
      color: isBuy ? COLORS.buy : COLORS.sell,
      size: size * 0.8,
      action: trade.action,
      label: trade.walletLabel,
      amount: fmtUsd(trade.amountUsd),
      token: trade.token,
      trail: [],
    });

    // Update node glow
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const tokenNode = nodes.find((n) => n.id === tokenId);
    if (sourceNode) { sourceNode.glow = 1; sourceNode.txCount++; }
    if (tokenNode) { tokenNode.glow = 1; tokenNode.txCount++; }

    // Track recent trades
    recentTradesRef.current.unshift(trade);
    if (recentTradesRef.current.length > 50) recentTradesRef.current.length = 50;
  }, []);

  // Trade generation interval
  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(() => {
      const trade = generateTrade(chainFilter);
      spawnParticle(trade);
      setStats((prev) => ({
        totalTrades: prev.totalTrades + 1,
        buys: prev.buys + (trade.action === 'buy' ? 1 : 0),
        sells: prev.sells + (trade.action === 'sell' ? 1 : 0),
        volume: prev.volume + trade.amountUsd,
      }));
    }, 400 + Math.random() * 600); // 2-4 trades/sec

    return () => clearInterval(interval);
  }, [playing, chainFilter, spawnParticle]);

  // Canvas animation loop
  useEffect(() => {
    initNodes();

    const resizeObserver = new ResizeObserver(() => initNodes());
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    let lastTime = performance.now();

    function render(time: number) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dt = Math.min(time - lastTime, 50) / 16.67; // Normalize to ~60fps
      lastTime = time;

      const dpr = window.devicePixelRatio || 1;
      const { w, h } = sizeRef.current;

      ctx.clearRect(0, 0, w * dpr, h * dpr);
      ctx.save();
      ctx.scale(dpr, dpr);

      // ─── Draw connections (faint lines between all connected node types) ───
      const nodes = nodesRef.current;
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.15;

      for (const wallet of nodes.filter((n) => n.type === 'wallet')) {
        for (const token of nodes.filter((n) => n.type === 'token')) {
          const cp = getControlPoint(wallet, token);
          ctx.beginPath();
          ctx.moveTo(wallet.x, wallet.y);
          ctx.quadraticCurveTo(cp.x, cp.y, token.x, token.y);
          ctx.stroke();
        }
      }
      for (const token of nodes.filter((n) => n.type === 'token')) {
        for (const exch of nodes.filter((n) => n.type === 'exchange' || n.type === 'dex')) {
          const cp = getControlPoint(token, exch);
          ctx.beginPath();
          ctx.moveTo(token.x, token.y);
          ctx.quadraticCurveTo(cp.x, cp.y, exch.x, exch.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // ─── Update & draw particles ───────────────────────
      const particles = particlesRef.current;
      const aliveParticles: Particle[] = [];

      for (const p of particles) {
        p.progress += p.speed * dt;

        if (p.progress < 0) {
          aliveParticles.push(p);
          continue;
        }

        if (p.progress >= 1) {
          // Particle arrived — pulse the target node
          const target = nodes.find((n) => n.id === p.targetId);
          if (target) target.glow = Math.min(1, target.glow + 0.3);
          continue; // Remove particle
        }

        const source = nodes.find((n) => n.id === p.sourceId);
        const target = nodes.find((n) => n.id === p.targetId);
        if (!source || !target) continue;

        const cp = getControlPoint(source, target);
        const pos = bezierPoint(source, cp, target, p.progress);

        // Trail
        p.trail.push({ x: pos.x, y: pos.y, alpha: 1 });
        if (p.trail.length > 12) p.trail.shift();

        // Draw trail
        for (let i = 0; i < p.trail.length; i++) {
          const t = p.trail[i];
          t.alpha *= 0.88;
          ctx.globalAlpha = t.alpha * 0.4;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(t.x, t.y, p.size * (i / p.trail.length) * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw particle
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        aliveParticles.push(p);
      }
      particlesRef.current = aliveParticles;

      // ─── Draw nodes ────────────────────────────────────
      for (const node of nodes) {
        // Decay glow
        node.glow *= 0.97;

        const r = node.radius;

        // Glow ring
        if (node.glow > 0.05) {
          ctx.globalAlpha = node.glow * 0.6;
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 2;
          ctx.shadowColor = node.color;
          ctx.shadowBlur = 15 * node.glow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4 + node.glow * 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Node body
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#1E2329';
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner color accent
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Node emoji
        ctx.globalAlpha = 1;
        ctx.font = `${r * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const emoji = NODE_TYPES[node.type]?.emoji ?? '●';
        ctx.fillText(emoji, node.x, node.y);

        // Node label
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + r + 6);

        // Transaction count badge
        if (node.txCount > 0) {
          const badgeText = node.txCount > 99 ? '99+' : String(node.txCount);
          ctx.font = 'bold 8px Inter, system-ui, sans-serif';
          const tw = ctx.measureText(badgeText).width;
          const bw = tw + 6;
          const bh = 13;
          const bx = node.x + r - 2;
          const by = node.y - r - 2;

          ctx.fillStyle = node.color;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 4);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = 1;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx, by);
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [initNodes]);

  // Mouse hit-testing for hover
  const handleMouseMove = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    let found: NetworkNode | null = null;
    for (const node of nodesRef.current) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy < (node.radius + 8) * (node.radius + 8)) {
        found = node;
        break;
      }
    }
    setHoveredNode(found);
  }, []);

  // Stats display refresh
  useEffect(() => {
    const interval = setInterval(() => forceRender((c) => c + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* ─── Controls ───────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${playing ? 'bg-gain animate-pulse' : 'bg-text-muted'}`} />
            <span className="text-xs text-text-muted font-medium">
              {playing ? 'LIVE' : 'PAUSED'}
            </span>
          </div>

          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              bg-surface border border-surface-border text-text-secondary hover:text-text-primary
              hover:border-surface-hover transition-colors"
          >
            {playing ? <Pause size={12} /> : <Play size={12} />}
            {playing ? 'Pause' : 'Resume'}
          </button>
        </div>

        {/* Chain filter */}
        <div className="flex items-center gap-1 bg-surface/50 p-0.5 rounded-lg border border-surface-border">
          {(['all', 'sol', 'bsc'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChainFilter(c)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors
                ${chainFilter === c
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'}`}
            >
              {c === 'all' ? 'All Chains' : c.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="hidden md:flex items-center gap-4 text-[10px] text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#16C784]" /> Buy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EA3943]" /> Sell
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F7931A]" /> Wallet
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3861FB]" /> Token
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#9333EA]" /> DEX
          </span>
        </div>
      </div>

      {/* ─── Canvas ─────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative rounded-xl border border-surface-border overflow-hidden"
        style={{ background: COLORS.bg }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredNode(null)}
          className="w-full cursor-crosshair"
          style={{ minHeight: 500, maxHeight: 700 }}
        />

        {/* Hover tooltip */}
        {hoveredNode && (
          <div
            className="fixed z-[100] pointer-events-none px-3 py-2 rounded-lg bg-surface-elevated
              border border-surface-border shadow-xl text-xs backdrop-blur-sm"
            style={{ left: mousePos.x + 12, top: mousePos.y - 40 }}
          >
            <div className="font-semibold text-text-primary">{hoveredNode.label}</div>
            <div className="text-text-muted capitalize">{hoveredNode.type}</div>
            <div className="text-text-secondary mt-1">{hoveredNode.txCount} transactions</div>
          </div>
        )}
      </div>

      {/* ─── Stats bar below canvas ─────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <MiniStat label="Total Trades" value={stats.totalTrades.toLocaleString()} />
        <MiniStat label="Buys" value={stats.buys.toLocaleString()} color="text-gain" />
        <MiniStat label="Sells" value={stats.sells.toLocaleString()} color="text-loss" />
        <MiniStat label="Volume" value={fmtUsd(stats.volume)} />
      </div>

      {/* ─── Recent trades feed (compact) ────────────────── */}
      <div className="mt-4 bg-surface rounded-xl border border-surface-border">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border">
          <h3 className="text-xs font-semibold text-text-primary flex items-center gap-2">
            <Radio size={12} className="text-gain" />
            Live Trade Feed
          </h3>
          <span className="text-[10px] text-text-muted font-mono">
            {recentTradesRef.current.length} recent
          </span>
        </div>
        <div className="max-h-[240px] overflow-y-auto scrollbar-thin">
          {recentTradesRef.current.slice(0, 20).map((trade) => (
            <div
              key={trade.id}
              className="flex items-center gap-3 px-4 py-2 border-b border-surface-border/50 last:border-0
                text-xs hover:bg-surface-hover/30 transition-colors"
            >
              {/* Action badge */}
              <span
                className={`w-14 text-center py-0.5 rounded text-[10px] font-bold uppercase
                  ${trade.action === 'buy'
                    ? 'bg-gain/10 text-gain'
                    : 'bg-loss/10 text-loss'}`}
              >
                {trade.action}
              </span>

              {/* Wallet */}
              <span className="text-text-secondary truncate w-24 font-medium">
                {trade.walletLabel}
              </span>

              {/* Token */}
              <span className="text-text-primary font-mono font-semibold w-16">
                {trade.token}
              </span>

              {/* Amount */}
              <span className={`font-mono w-20 text-right ${trade.action === 'buy' ? 'text-gain' : 'text-loss'}`}>
                {fmtUsd(trade.amountUsd)}
              </span>

              {/* Chain badge */}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded
                ${trade.chain === 'sol' ? 'bg-[#00FFA3]/10 text-[#00FFA3]' : 'bg-[#F7931A]/10 text-[#F7931A]'}`}>
                {trade.chain.toUpperCase()}
              </span>

              {/* Exchange */}
              <span className="text-text-muted truncate hidden sm:block">
                via {trade.exchange}
              </span>

              {/* Time */}
              <span className="text-text-muted ml-auto font-mono">
                {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
          {recentTradesRef.current.length === 0 && (
            <div className="px-4 py-8 text-center text-text-muted text-sm">
              Waiting for trades...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mini stat ──────────────────────────────────────────────

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface rounded-lg border border-surface-border px-3 py-2">
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold font-mono ${color ?? 'text-text-primary'}`}>{value}</div>
    </div>
  );
}

export default NetworkFlowViz;
