/**
 * Real-Time Network Flow — Animated Trade Visualization
 *
 * An animated force-layout-style network graph where wallet category nodes
 * orbit the perimeter and token nodes cluster in the center. When a trade
 * event fires, a glowing particle animates along a curved path from the
 * wallet category → token (buy) or token → wallet (sell).
 *
 * Visual:
 * ┌────────────────────────────────────────────────────────────┐
 * │  [Smart Degen]                           [KOL]            │
 * │          ╲  ·····buy·····→  TOKEN_A  ←···sell···  ╱       │
 * │  [Sniper] ─→ ········→  TOKEN_B  ←········  ← [Fresh]    │
 * │          ╱  ·····buy·····→  TOKEN_C  ←···sell···  ╲       │
 * │  [Launchpad]                           [Top Dev]          │
 * └────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Category hub nodes positioned in a ring
 * - Token nodes positioned in center cluster, sized by trade volume
 * - Animated particles with glow trails: green (buy) / red (sell) / blue (first buy)
 * - Pulsing nodes on activity
 * - Mini trade ticker overlay
 * - Chain filter (BSC / SOL / All)
 */

'use client';

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { tokens } from '@/lib/colors';
import type { TradeEvent, GmgnWalletCategory, GmgnChain } from './gmgn-types';

// ─── Constants ──────────────────────────────────────────────

const CANVAS_W = 1200;
const CANVAS_H = 700;
const CENTER_X = CANVAS_W / 2;
const CENTER_Y = CANVAS_H / 2;
const RING_RADIUS = 280;
const TOKEN_RADIUS = 120;

const CATEGORY_LABELS: Record<string, string> = {
  smart_degen: 'Smart Degen',
  launchpad_smart: 'Launchpad',
  fresh_wallet: 'Fresh Wallet',
  snipe_bot: 'Sniper Bot',
  live: 'Live Trader',
  top_dev: 'Top Dev',
  top_followed: 'Top Followed',
  top_renamed: 'Top Renamed',
  kol: 'KOL',
};

const CATEGORY_COLORS: Record<string, string> = {
  smart_degen: '#F7931A',
  launchpad_smart: '#9B59B6',
  fresh_wallet: '#3498DB',
  snipe_bot: '#E74C3C',
  live: '#16C784',
  top_dev: '#F39C12',
  top_followed: '#1ABC9C',
  top_renamed: '#E91E63',
  kol: '#8B5CF6',
};

const ACTION_COLORS = {
  buy: '#16C784',
  sell: '#EA3943',
  first_buy: '#3861FB',
} as const;

const PARTICLE_SPEED = 0.012;

// ─── Types ──────────────────────────────────────────────────

interface CategoryNode {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  radius: number;
  tradeCount: number;
  pulsePhase: number;
}

interface TokenNode {
  id: string;
  symbol: string;
  x: number;
  y: number;
  radius: number;
  tradeCount: number;
  totalVolume: number;
  pulsePhase: number;
}

interface Particle {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  cpX: number;
  cpY: number;
  progress: number;
  color: string;
  size: number;
  action: 'buy' | 'sell' | 'first_buy';
  label: string;
  amount: number;
  opacity: number;
}

interface TickerItem {
  id: string;
  text: string;
  color: string;
  time: number;
}

// ─── Props ──────────────────────────────────────────────────

interface NetworkFlowProps {
  trades: TradeEvent[];
  className?: string;
}

// ─── Component ──────────────────────────────────────────────

export function NetworkFlow({ trades, className }: NetworkFlowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const tickerRef = useRef<TickerItem[]>([]);
  const tradeIndexRef = useRef(0);
  const lastEmitRef = useRef(0);
  const categoryNodesRef = useRef<CategoryNode[]>([]);
  const tokenNodesRef = useRef<TokenNode[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stats, setStats] = useState({ buys: 0, sells: 0, volume: 0 });

  // Build category nodes in a ring
  const categoryNodes = useMemo(() => {
    const cats = Object.keys(CATEGORY_LABELS);
    return cats.map((cat, i): CategoryNode => {
      const angle = (i / cats.length) * Math.PI * 2 - Math.PI / 2;
      return {
        id: cat,
        label: CATEGORY_LABELS[cat],
        color: CATEGORY_COLORS[cat],
        x: CENTER_X + Math.cos(angle) * RING_RADIUS,
        y: CENTER_Y + Math.sin(angle) * RING_RADIUS,
        radius: 28,
        tradeCount: 0,
        pulsePhase: 0,
      };
    });
  }, []);

  // Build token nodes from trade data
  const tokenNodes = useMemo(() => {
    const tokenMap = new Map<string, { symbol: string; count: number; volume: number }>();
    for (const t of trades) {
      const existing = tokenMap.get(t.tokenSymbol);
      if (existing) {
        existing.count++;
        existing.volume += t.amountUsd;
      } else {
        tokenMap.set(t.tokenSymbol, { symbol: t.tokenSymbol, count: 1, volume: t.amountUsd });
      }
    }

    // Top 12 tokens by volume
    const sorted = [...tokenMap.entries()]
      .sort(([, a], [, b]) => b.volume - a.volume)
      .slice(0, 12);

    const maxVol = sorted[0]?.[1].volume || 1;

    return sorted.map(([sym, data], i): TokenNode => {
      const angle = (i / sorted.length) * Math.PI * 2 + Math.PI / 6;
      const dist = TOKEN_RADIUS * (0.4 + 0.6 * (i / sorted.length));
      return {
        id: sym,
        symbol: sym,
        x: CENTER_X + Math.cos(angle) * dist,
        y: CENTER_Y + Math.sin(angle) * dist,
        radius: 12 + (data.volume / maxVol) * 22,
        tradeCount: data.count,
        totalVolume: data.volume,
        pulsePhase: 0,
      };
    });
  }, [trades]);

  // Persist nodes to refs for animation loop access
  useEffect(() => {
    categoryNodesRef.current = categoryNodes.map((n) => ({ ...n }));
    tokenNodesRef.current = tokenNodes.map((n) => ({ ...n }));
  }, [categoryNodes, tokenNodes]);

  // Emit a trade as a particle
  const emitTrade = useCallback((trade: TradeEvent) => {
    const catNode = categoryNodesRef.current.find((n) => n.id === trade.walletCategory);
    const tokNode = tokenNodesRef.current.find((n) => n.id === trade.tokenSymbol);

    if (!catNode || !tokNode) return;

    const isBuy = trade.action === 'buy' || trade.action === 'first_buy';
    const fromX = isBuy ? catNode.x : tokNode.x;
    const fromY = isBuy ? catNode.y : tokNode.y;
    const toX = isBuy ? tokNode.x : catNode.x;
    const toY = isBuy ? tokNode.y : catNode.y;

    // Bezier control point — curve outward from center
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const perpX = -dy * 0.3 * (Math.random() > 0.5 ? 1 : -1);
    const perpY = dx * 0.3 * (Math.random() > 0.5 ? 1 : -1);

    const sizeBase = Math.min(Math.max(Math.log10(trade.amountUsd + 1) - 1, 1), 5);

    particlesRef.current.push({
      id: trade.id + '-' + Date.now(),
      fromX,
      fromY,
      toX,
      toY,
      cpX: midX + perpX,
      cpY: midY + perpY,
      progress: 0,
      color: ACTION_COLORS[trade.action],
      size: sizeBase,
      action: trade.action,
      label: `${trade.walletLabel} ${isBuy ? '→' : '←'} ${trade.tokenSymbol}`,
      amount: trade.amountUsd,
      opacity: 1,
    });

    // Pulse the nodes
    catNode.pulsePhase = 1;
    catNode.tradeCount++;
    tokNode.pulsePhase = 1;
    tokNode.tradeCount++;

    // Add to ticker
    const arrow = isBuy ? '→' : '←';
    tickerRef.current.unshift({
      id: trade.id,
      text: `${trade.walletLabel} ${arrow} $${formatUsd(trade.amountUsd)} ${trade.tokenSymbol}`,
      color: ACTION_COLORS[trade.action],
      time: Date.now(),
    });
    if (tickerRef.current.length > 20) tickerRef.current.pop();
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR scaling
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.scale(dpr, dpr);

    let buys = 0;
    let sells = 0;
    let volume = 0;

    function animate() {
      if (!ctx) return;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // ─── Background grid ──────────────────────────────
      ctx.strokeStyle = 'rgba(43, 53, 68, 0.3)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < CANVAS_W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_H);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }

      // ─── Connection lines (faint) ─────────────────────
      const catNodes = categoryNodesRef.current;
      const tokNodes = tokenNodesRef.current;

      ctx.strokeStyle = 'rgba(56, 97, 251, 0.06)';
      ctx.lineWidth = 1;
      for (const cat of catNodes) {
        for (const tok of tokNodes) {
          ctx.beginPath();
          ctx.moveTo(cat.x, cat.y);
          ctx.lineTo(tok.x, tok.y);
          ctx.stroke();
        }
      }

      // ─── Token nodes ──────────────────────────────────
      for (const tok of tokNodes) {
        // Pulse decay
        if (tok.pulsePhase > 0) tok.pulsePhase = Math.max(0, tok.pulsePhase - 0.02);

        const pulseSize = tok.radius + tok.pulsePhase * 12;

        // Outer glow
        if (tok.pulsePhase > 0.1) {
          const grad = ctx.createRadialGradient(tok.x, tok.y, tok.radius, tok.x, tok.y, pulseSize + 10);
          grad.addColorStop(0, `rgba(56, 97, 251, ${tok.pulsePhase * 0.3})`);
          grad.addColorStop(1, 'rgba(56, 97, 251, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(tok.x, tok.y, pulseSize + 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node body
        ctx.fillStyle = 'rgba(30, 35, 41, 0.9)';
        ctx.strokeStyle = `rgba(56, 97, 251, ${0.4 + tok.pulsePhase * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tok.x, tok.y, tok.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Symbol label
        ctx.fillStyle = tokens.text.primary;
        ctx.font = `bold ${Math.max(9, tok.radius * 0.55)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tok.symbol.slice(0, 6), tok.x, tok.y);
      }

      // ─── Category nodes ───────────────────────────────
      for (const cat of catNodes) {
        if (cat.pulsePhase > 0) cat.pulsePhase = Math.max(0, cat.pulsePhase - 0.015);

        const pulseSize = cat.radius + cat.pulsePhase * 16;

        // Outer glow
        if (cat.pulsePhase > 0.1) {
          const grad = ctx.createRadialGradient(cat.x, cat.y, cat.radius, cat.x, cat.y, pulseSize + 14);
          grad.addColorStop(0, `${cat.color}${Math.round(cat.pulsePhase * 60).toString(16).padStart(2, '0')}`);
          grad.addColorStop(1, `${cat.color}00`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cat.x, cat.y, pulseSize + 14, 0, Math.PI * 2);
          ctx.fill();
        }

        // Body
        ctx.fillStyle = `${cat.color}20`;
        ctx.strokeStyle = `${cat.color}${Math.round((0.6 + cat.pulsePhase * 0.4) * 255).toString(16).padStart(2, '0')}`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cat.x, cat.y, cat.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Icon dot
        ctx.fillStyle = cat.color;
        ctx.beginPath();
        ctx.arc(cat.x, cat.y - 6, 4, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = tokens.text.primary;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cat.label, cat.x, cat.y + 8);

        // Trade count badge
        if (cat.tradeCount > 0) {
          const badgeX = cat.x + cat.radius - 4;
          const badgeY = cat.y - cat.radius + 4;
          ctx.fillStyle = cat.color;
          ctx.beginPath();
          ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText(cat.tradeCount > 99 ? '99+' : String(cat.tradeCount), badgeX, badgeY);
        }
      }

      // ─── Particles ────────────────────────────────────
      const nextParticles: Particle[] = [];
      for (const p of particlesRef.current) {
        p.progress += PARTICLE_SPEED * speed;

        if (p.progress >= 1) {
          // Particle reached destination — fade out
          p.opacity -= 0.05;
          if (p.opacity <= 0) continue;
        }

        const t = Math.min(p.progress, 1);
        // Quadratic bezier position
        const x = (1 - t) * (1 - t) * p.fromX + 2 * (1 - t) * t * p.cpX + t * t * p.toX;
        const y = (1 - t) * (1 - t) * p.fromY + 2 * (1 - t) * t * p.cpY + t * t * p.toY;

        // Glow trail
        const trailGrad = ctx.createRadialGradient(x, y, 0, x, y, p.size * 6);
        trailGrad.addColorStop(0, `${p.color}${Math.round(p.opacity * 80).toString(16).padStart(2, '0')}`);
        trailGrad.addColorStop(1, `${p.color}00`);
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 6, 0, Math.PI * 2);
        ctx.fill();

        // Core particle
        ctx.fillStyle = `${p.color}${Math.round(p.opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Bright center
        ctx.fillStyle = `rgba(255,255,255,${p.opacity * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        nextParticles.push(p);
      }
      particlesRef.current = nextParticles;

      // ─── Emit trades on interval ──────────────────────
      if (!isPaused && trades.length > 0) {
        const now = performance.now();
        const interval = 300 / speed;
        if (now - lastEmitRef.current > interval) {
          const trade = trades[tradeIndexRef.current % trades.length];
          emitTrade(trade);

          if (trade.action === 'buy' || trade.action === 'first_buy') {
            buys++;
            volume += trade.amountUsd;
          } else {
            sells++;
            volume += trade.amountUsd;
          }
          setStats({ buys, sells, volume });

          tradeIndexRef.current++;
          lastEmitRef.current = now;
        }
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [trades, isPaused, speed, emitTrade]);

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: CANVAS_W, height: CANVAS_H }}
        className="w-full h-auto rounded-xl bg-background-primary"
      />

      {/* ─── Controls overlay ─────────────────────────── */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          onClick={() => setIsPaused(!isPaused)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface/80 backdrop-blur border border-surface-border text-text-secondary hover:text-text-primary transition-colors"
        >
          {isPaused ? '▶ Play' : '⏸ Pause'}
        </button>
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="px-2 py-1.5 text-xs font-medium rounded-lg bg-surface/80 backdrop-blur border border-surface-border text-text-secondary appearance-none cursor-pointer"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      {/* ─── Stats overlay ────────────────────────────── */}
      <div className="absolute top-3 left-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface/80 backdrop-blur border border-surface-border">
          <div className="w-2 h-2 rounded-full bg-gain animate-pulse" />
          <span className="text-[10px] text-text-muted">LIVE</span>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg bg-surface/80 backdrop-blur border border-surface-border text-xs text-text-secondary font-mono">
          <span className="text-gain">{stats.buys} buys</span>
          <span className="text-text-muted mx-1.5">·</span>
          <span className="text-loss">{stats.sells} sells</span>
          <span className="text-text-muted mx-1.5">·</span>
          <span className="text-text-primary">${formatUsd(stats.volume)}</span>
        </div>
      </div>

      {/* ─── Legend ────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3">
        {Object.entries(ACTION_COLORS).map(([action, color]) => (
          <div key={action} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-text-muted capitalize">{action.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* ─── Live ticker ──────────────────────────────── */}
      <div className="absolute bottom-3 right-3 w-72">
        <div className="bg-surface/80 backdrop-blur rounded-lg border border-surface-border p-2 max-h-40 overflow-hidden">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1 font-semibold">
            Trade Feed
          </div>
          {tickerRef.current.slice(0, 8).map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 py-0.5">
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-[10px] text-text-secondary truncate font-mono">{item.text}</span>
            </div>
          ))}
          {tickerRef.current.length === 0 && (
            <span className="text-[10px] text-text-muted">Waiting for trades…</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
