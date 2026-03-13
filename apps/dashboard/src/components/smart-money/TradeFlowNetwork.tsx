/**
 * Trade Flow Network — Canvas-based Animated Node Visualization
 *
 * Interactive network graph where:
 * - Nodes represent wallets, tokens, and pools
 * - Edges connect them based on trade relationships
 * - Animated particles flow along edges when trades occur
 * - Green particles = buys, Red particles = sells
 * - Node size reflects volume, pulse on activity
 *
 * Built on raw Canvas2D for maximum performance (60fps).
 * Simulates live trade flow from the wallet JSON data.
 */

'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import type { SimulatedTrade, Chain } from '@/lib/smart-money-data';

// ─── Types ──────────────────────────────────────────────────

interface Node {
  id: string;
  label: string;
  type: 'wallet' | 'token' | 'pool';
  chain: Chain;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  color: string;
  pulsePhase: number;
  activity: number;
  tradeCount: number;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
  color: string;
}

interface Particle {
  edgeIdx: number;
  progress: number;
  speed: number;
  color: string;
  size: number;
  alpha: number;
}

// ─── Colors ─────────────────────────────────────────────────

const COLORS = {
  buy: '#00ff00',
  sell: '#ff0000',
  walletSol: '#9945FF',
  walletBsc: '#F0B90B',
  token: '#00d4aa',
  pool: '#7b61ff',
  edgeDefault: 'rgba(255,255,255,0.04)',
  bg: '#000000',
  text: '#ffffff',
  textMuted: '#666666',
};

// ─── Helpers ────────────────────────────────────────────────

function shortenLabel(s: string, maxLen: number = 12): string {
  if (!s) return '???';
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Component ──────────────────────────────────────────────

interface TradeFlowNetworkProps {
  trades: SimulatedTrade[];
  className?: string;
}

export function TradeFlowNetwork({ trades, className }: TradeFlowNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const tradeIdxRef = useRef(0);
  const lastTradeTimeRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, particles: 0 });

  // Build graph from trades
  const buildGraph = useCallback((width: number, height: number) => {
    const nodeMap = new Map<string, Node>();
    const edgeMap = new Map<string, Edge>();

    const centerX = width / 2;
    const centerY = height / 2;
    const orbitR = Math.min(width, height) * 0.35;

    // Extract unique wallets & tokens
    const wallets = new Map<string, { label: string; chain: Chain; count: number }>();
    const tokens = new Map<string, { label: string; chain: Chain; count: number }>();

    for (const t of trades) {
      const wKey = `w:${t.chain}:${t.wallet.slice(0, 10)}`;
      const existing = wallets.get(wKey);
      if (existing) {
        existing.count++;
      } else {
        wallets.set(wKey, { label: t.walletLabel, chain: t.chain, count: 1 });
      }

      const tKey = `t:${t.chain}:${t.tokenSymbol}`;
      const existingT = tokens.get(tKey);
      if (existingT) {
        existingT.count++;
      } else {
        tokens.set(tKey, { label: t.tokenSymbol, chain: t.chain, count: 1 });
      }
    }

    // Limit nodes for visual clarity
    const topWallets = [...wallets.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);
    const topTokens = [...tokens.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 16);

    // Place wallet nodes on left arc
    topWallets.forEach(([id, w], i) => {
      const angle = -Math.PI * 0.6 + (Math.PI * 1.2 * i) / Math.max(topWallets.length - 1, 1);
      const r = orbitR * (0.85 + Math.random() * 0.3);
      nodeMap.set(id, {
        id,
        label: w.label,
        type: 'wallet',
        chain: w.chain,
        x: centerX - orbitR * 0.5 + Math.cos(angle) * r * 0.5,
        y: centerY + Math.sin(angle) * r * 0.7,
        vx: 0,
        vy: 0,
        radius: 6 + Math.min(w.count, 12) * 1.5,
        baseRadius: 6 + Math.min(w.count, 12) * 1.5,
        color: w.chain === 'sol' ? COLORS.walletSol : COLORS.walletBsc,
        pulsePhase: Math.random() * Math.PI * 2,
        activity: 0,
        tradeCount: w.count,
      });
    });

    // Place token nodes on right arc
    topTokens.forEach(([id, t], i) => {
      const angle = -Math.PI * 0.5 + (Math.PI * 1.0 * i) / Math.max(topTokens.length - 1, 1);
      const r = orbitR * (0.85 + Math.random() * 0.3);
      nodeMap.set(id, {
        id,
        label: t.label,
        type: 'token',
        chain: t.chain,
        x: centerX + orbitR * 0.5 + Math.cos(angle) * r * 0.5,
        y: centerY + Math.sin(angle) * r * 0.7,
        vx: 0,
        vy: 0,
        radius: 8 + Math.min(t.count, 10) * 1.5,
        baseRadius: 8 + Math.min(t.count, 10) * 1.5,
        color: COLORS.token,
        pulsePhase: Math.random() * Math.PI * 2,
        activity: 0,
        tradeCount: t.count,
      });
    });

    // Build edges from actual trades
    for (const t of trades) {
      const wKey = `w:${t.chain}:${t.wallet.slice(0, 10)}`;
      const tKey = `t:${t.chain}:${t.tokenSymbol}`;
      if (!nodeMap.has(wKey) || !nodeMap.has(tKey)) continue;

      const eKey = `${wKey}→${tKey}`;
      const existing = edgeMap.get(eKey);
      if (existing) {
        existing.weight++;
      } else {
        edgeMap.set(eKey, {
          source: wKey,
          target: tKey,
          weight: 1,
          color: COLORS.edgeDefault,
        });
      }
    }

    nodesRef.current = [...nodeMap.values()];
    edgesRef.current = [...edgeMap.values()];
  }, [trades]);

  // Mouse tracking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = null;
    hoveredNodeRef.current = null;
  }, []);

  // Emit a trade particle
  const emitTrade = useCallback((trade: SimulatedTrade) => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    const wKey = `w:${trade.chain}:${trade.wallet.slice(0, 10)}`;
    const tKey = `t:${trade.chain}:${trade.tokenSymbol}`;

    const edgeIdx = edges.findIndex(
      (e) => e.source === wKey && e.target === tKey,
    );
    if (edgeIdx === -1) return;

    const isBuy = trade.action === 'buy' || trade.action === 'first_buy' || trade.action === 'buy_more';
    const color = isBuy ? COLORS.buy : COLORS.sell;

    // Emit 1-3 particles
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        edgeIdx,
        progress: -0.05 * i,
        speed: 0.008 + Math.random() * 0.006,
        color,
        size: 2 + Math.random() * 2.5,
        alpha: 0.9,
      });
    }

    // Pulse source and target nodes
    const sourceNode = nodes.find((n) => n.id === wKey);
    const targetNode = nodes.find((n) => n.id === tKey);
    if (sourceNode) sourceNode.activity = 1.0;
    if (targetNode) targetNode.activity = 0.8;

    // Flash edge color
    edges[edgeIdx].color = color;
    setTimeout(() => {
      if (edges[edgeIdx]) edges[edgeIdx].color = COLORS.edgeDefault;
    }, 800);
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGraph(rect.width, rect.height);
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let time = 0;

    const render = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const particles = particlesRef.current;

      // Clear
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      time += 0.016;

      // ── Emit trades periodically ──
      if (trades.length > 0 && time - lastTradeTimeRef.current > 0.6 + Math.random() * 0.8) {
        const idx = tradeIdxRef.current % trades.length;
        emitTrade(trades[idx]);
        tradeIdxRef.current++;
        lastTradeTimeRef.current = time;
      }

      // ── Hit-test mouse ──
      hoveredNodeRef.current = null;
      if (mouseRef.current) {
        for (const node of nodes) {
          const dx = mouseRef.current.x - node.x;
          const dy = mouseRef.current.y - node.y;
          if (dx * dx + dy * dy < (node.radius + 8) * (node.radius + 8)) {
            hoveredNodeRef.current = node.id;
            break;
          }
        }
      }

      // ── Gentle force simulation ──
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = a.radius + b.radius + 30;
          if (dist < minDist) {
            const force = (minDist - dist) * 0.002;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }
        const n = nodes[i];
        // Boundary repulsion
        if (n.x < n.radius + 20) n.vx += 0.3;
        if (n.x > w - n.radius - 20) n.vx -= 0.3;
        if (n.y < n.radius + 20) n.vy += 0.3;
        if (n.y > h - n.radius - 20) n.vy -= 0.3;

        n.vx *= 0.95;
        n.vy *= 0.95;
        n.x += n.vx;
        n.y += n.vy;

        // Decay activity
        n.activity *= 0.97;

        // Pulse
        n.pulsePhase += 0.02;
        n.radius = n.baseRadius + Math.sin(n.pulsePhase) * 1 + n.activity * 6;
      }

      // ── Draw edges ──
      for (const edge of edges) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;

        ctx.beginPath();
        ctx.strokeStyle = edge.color;
        ctx.lineWidth = 0.5 + Math.min(edge.weight, 8) * 0.15;
        ctx.globalAlpha = hoveredNodeRef.current
          ? (hoveredNodeRef.current === src.id || hoveredNodeRef.current === tgt.id ? 0.3 : 0.03)
          : 0.08;

        // Bezier curve
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2 - 20;
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(mx, my, tgt.x, tgt.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // ── Draw particles ──
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.progress += p.speed;

        if (p.progress > 1.1) {
          particles.splice(i, 1);
          continue;
        }

        if (p.progress < 0) continue;

        const edge = edges[p.edgeIdx];
        if (!edge) { particles.splice(i, 1); continue; }

        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (!src || !tgt) continue;

        const t = Math.min(Math.max(p.progress, 0), 1);
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2 - 20;

        // Quadratic bezier point
        const px = (1 - t) * (1 - t) * src.x + 2 * (1 - t) * t * mx + t * t * tgt.x;
        const py = (1 - t) * (1 - t) * src.y + 2 * (1 - t) * t * my + t * t * tgt.y;

        // Fade in/out
        p.alpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 0.9;

        // Glow
        ctx.beginPath();
        ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * 0.15;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Draw nodes ──
      for (const node of nodes) {
        const isHovered = hoveredNodeRef.current === node.id;

        // Outer glow on activity
        if (node.activity > 0.1 || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 12, 0, Math.PI * 2);
          ctx.fillStyle = node.color;
          ctx.globalAlpha = isHovered ? 0.15 : node.activity * 0.12;
          ctx.fill();
        }

        // Node body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.globalAlpha = isHovered ? 0.9 : 0.6 + node.activity * 0.3;
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.strokeStyle = node.color;
        ctx.lineWidth = isHovered ? 2.5 : 1;
        ctx.globalAlpha = isHovered ? 1 : 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Label
        const dimmed = hoveredNodeRef.current && !isHovered;
        ctx.font = `${isHovered ? '11px' : '9px'} 'Inter', sans-serif`;
        ctx.fillStyle = COLORS.text;
        ctx.globalAlpha = dimmed ? 0.15 : isHovered ? 1 : 0.6;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(
          shortenLabel(node.label, isHovered ? 20 : 10),
          node.x,
          node.y + node.radius + 4,
        );

        // Type label (small)
        if (isHovered) {
          ctx.font = "8px 'JetBrains Mono', monospace";
          ctx.fillStyle = COLORS.textMuted;
          ctx.globalAlpha = 0.7;
          ctx.fillText(
            `${node.type.toUpperCase()} · ${node.chain.toUpperCase()} · ${node.tradeCount} trades`,
            node.x,
            node.y + node.radius + 18,
          );
        }
      }
      ctx.globalAlpha = 1;

      // ── Legend ──
      ctx.font = "9px 'Inter', sans-serif";
      const legendY = h - 20;
      const drawLegendDot = (x: number, color: string, label: string) => {
        ctx.beginPath();
        ctx.arc(x, legendY, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'left';
        ctx.fillText(label, x + 8, legendY + 3);
      };
      drawLegendDot(16, COLORS.buy, 'Buy');
      drawLegendDot(60, COLORS.sell, 'Sell');
      drawLegendDot(104, COLORS.walletSol, 'SOL Wallet');
      drawLegendDot(184, COLORS.walletBsc, 'BSC Wallet');
      drawLegendDot(264, COLORS.token, 'Token');
      ctx.globalAlpha = 1;

      // Stats
      setStats({ nodes: nodes.length, edges: edges.length, particles: particles.length });

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [trades, buildGraph, emitTrade, handleMouseMove, handleMouseLeave]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-xl"
        style={{ background: '#000' }}
      />
      {/* Stats overlay */}
      <div className="absolute top-3 right-3 flex items-center gap-3 text-[10px] text-[#666] font-mono">
        <span>{stats.nodes} nodes</span>
        <span>{stats.edges} edges</span>
        <span className="text-[#00ff00]">{stats.particles} particles</span>
      </div>
    </div>
  );
}
