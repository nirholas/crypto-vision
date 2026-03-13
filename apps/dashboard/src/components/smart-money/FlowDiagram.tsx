/**
 * Smart Money Flow Diagram — SVG Sankey-style Visualization
 *
 * Shows wallet/exchange nodes with directed, animated flow paths.
 * - Left column: source nodes (senders)
 * - Right column: target nodes (receivers)
 * - Bezier curves connect them, width proportional to USD volume
 * - Color coded: green = withdrawal (bullish), red = deposit (bearish), blue = transfer
 * - Animated dash strokes for live feel
 */

'use client';

import { useMemo, useState } from 'react';
import { tokens } from '@/lib/colors';
import type { FlowData, FlowLink, FlowNode } from './types';

// ─── Constants ──────────────────────────────────────────────

const SVG_WIDTH = 900;
const SVG_HEIGHT = 560;
const NODE_WIDTH = 14;
const NODE_PADDING = 8;
const LEFT_X = 40;
const RIGHT_X = SVG_WIDTH - 40 - NODE_WIDTH;
const MIN_LINK_WIDTH = 1.5;
const MAX_LINK_WIDTH = 18;

const FLOW_COLORS: Record<string, string> = {
  exchange_withdrawal: tokens.semantic.gain,
  exchange_deposit: tokens.semantic.loss,
  whale_transfer: tokens.brand.primary,
  unknown: tokens.text.muted,
};

// ─── Props ──────────────────────────────────────────────────

interface FlowDiagramProps {
  data: FlowData;
  className?: string;
}

// ─── Component ──────────────────────────────────────────────

export function FlowDiagram({ data, className }: FlowDiagramProps) {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const layout = useMemo(() => computeLayout(data), [data]);

  if (layout.links.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 text-text-muted ${className ?? ''}`}>
        <p className="text-sm">No flow data available. Whale transactions will appear here.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-auto font-mono"
        role="img"
        aria-label="Smart money flow diagram showing wallet-to-exchange fund movements"
      >
        <defs>
          <style>{`
            @keyframes flowDash {
              to { stroke-dashoffset: -40; }
            }
            .flow-link {
              fill: none;
              stroke-linecap: round;
              opacity: 0.55;
              transition: opacity 0.2s;
            }
            .flow-link:hover, .flow-link--active {
              opacity: 0.9;
            }
            .flow-link--animated {
              stroke-dasharray: 8 12;
              animation: flowDash 2s linear infinite;
            }
          `}</style>
        </defs>

        {/* Links (bezier curves) */}
        {layout.links.map((link) => {
          const isActive = hoveredLink === link.key ||
            hoveredNode === link.source ||
            hoveredNode === link.target;

          return (
            <g key={link.key}>
              <path
                d={link.path}
                className={`flow-link ${isActive ? 'flow-link--active' : ''} flow-link--animated`}
                stroke={link.color}
                strokeWidth={link.width}
                onMouseEnter={() => setHoveredLink(link.key)}
                onMouseLeave={() => setHoveredLink(null)}
              />
              {/* Hover tooltip area */}
              <path
                d={link.path}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(link.width, 12)}
                onMouseEnter={() => setHoveredLink(link.key)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                <title>
                  {link.sourceLabel} → {link.targetLabel}{'\n'}
                  ${formatUsd(link.value)} ({link.count} txn{link.count > 1 ? 's' : ''})
                </title>
              </path>
            </g>
          );
        })}

        {/* Source nodes (left) */}
        {layout.sourceNodes.map((node) => (
          <g
            key={node.id}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <rect
              x={node.x}
              y={node.y}
              width={NODE_WIDTH}
              height={node.height}
              rx={3}
              fill={nodeColor(node)}
              opacity={hoveredNode && hoveredNode !== node.id ? 0.3 : 0.9}
              className="transition-opacity"
            />
            <text
              x={node.x - 6}
              y={node.y + node.height / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fill={tokens.text.secondary}
              fontSize={10}
              opacity={hoveredNode && hoveredNode !== node.id ? 0.3 : 1}
            >
              {node.label}
            </text>
            {/* Chain badge */}
            {node.chain && (
              <text
                x={node.x - 6}
                y={node.y + node.height / 2 + 13}
                textAnchor="end"
                dominantBaseline="middle"
                fill={chainColor(node.chain)}
                fontSize={8}
                fontWeight={600}
              >
                {node.chain.toUpperCase()}
              </text>
            )}
            <title>{node.label} — ${formatUsd(node.value)}</title>
          </g>
        ))}

        {/* Target nodes (right) */}
        {layout.targetNodes.map((node) => (
          <g
            key={node.id}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            <rect
              x={node.x}
              y={node.y}
              width={NODE_WIDTH}
              height={node.height}
              rx={3}
              fill={nodeColor(node)}
              opacity={hoveredNode && hoveredNode !== node.id ? 0.3 : 0.9}
              className="transition-opacity"
            />
            <text
              x={node.x + NODE_WIDTH + 6}
              y={node.y + node.height / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fill={tokens.text.secondary}
              fontSize={10}
              opacity={hoveredNode && hoveredNode !== node.id ? 0.3 : 1}
            >
              {node.label}
            </text>
            {node.chain && (
              <text
                x={node.x + NODE_WIDTH + 6}
                y={node.y + node.height / 2 + 13}
                textAnchor="start"
                dominantBaseline="middle"
                fill={chainColor(node.chain)}
                fontSize={8}
                fontWeight={600}
              >
                {node.chain.toUpperCase()}
              </text>
            )}
            {/* Net direction indicator */}
            <circle
              cx={node.x + NODE_WIDTH + NODE_WIDTH}
              cy={node.y + 3}
              r={3}
              fill={node.netDirection === 'inflow' ? tokens.semantic.gain : tokens.semantic.loss}
            />
            <title>{node.label} — ${formatUsd(node.value)}</title>
          </g>
        ))}

        {/* Legend */}
        <g transform={`translate(${SVG_WIDTH / 2 - 120}, ${SVG_HEIGHT - 24})`}>
          {[
            { label: 'Exchange Withdrawal', color: tokens.semantic.gain },
            { label: 'Exchange Deposit', color: tokens.semantic.loss },
            { label: 'Whale Transfer', color: tokens.brand.primary },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 160}, 0)`}>
              <line x1={0} y1={6} x2={20} y2={6} stroke={item.color} strokeWidth={2.5} />
              <text x={24} y={10} fill={tokens.text.muted} fontSize={9}>
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

// ─── Layout Engine ──────────────────────────────────────────

interface LayoutNode extends FlowNode {
  x: number;
  y: number;
  height: number;
  netDirection: 'inflow' | 'outflow';
}

interface LayoutLink {
  key: string;
  path: string;
  color: string;
  width: number;
  value: number;
  count: number;
  source: string;
  target: string;
  sourceLabel: string;
  targetLabel: string;
  sourceY: number;
  targetY: number;
}

function computeLayout(data: FlowData) {
  // Split nodes into sources (senders) and targets (receivers)
  const sourceIds = new Set(data.links.map((l) => l.source));
  const targetIds = new Set(data.links.map((l) => l.target));

  // Nodes that only appear as source
  const pureSourceIds = [...sourceIds].filter((id) => !targetIds.has(id));
  // Nodes that only appear as target
  const pureTargetIds = [...targetIds].filter((id) => !sourceIds.has(id));
  // Nodes that are both — put them on source side
  const bothIds = [...sourceIds].filter((id) => targetIds.has(id));

  const allSourceIds = [...pureSourceIds, ...bothIds];
  const allTargetIds = pureTargetIds;

  // If all nodes are on one side, split by value
  if (allSourceIds.length === 0 || allTargetIds.length === 0) {
    const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
    const sorted = [...nodeMap.values()].sort((a, b) => b.value - a.value);
    const half = Math.ceil(sorted.length / 2);
    return computeLayoutFromSplit(
      sorted.slice(0, half),
      sorted.slice(half),
      data.links,
    );
  }

  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const sources = allSourceIds
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as FlowNode[];
  const targets = allTargetIds
    .map((id) => nodeMap.get(id))
    .filter(Boolean) as FlowNode[];

  return computeLayoutFromSplit(sources, targets, data.links);
}

function computeLayoutFromSplit(
  sources: FlowNode[],
  targets: FlowNode[],
  links: FlowLink[],
) {
  const maxVal = Math.max(...[...sources, ...targets].map((n) => n.value), 1);
  const usableHeight = SVG_HEIGHT - 60;

  // Position source nodes
  const sourceNodes: LayoutNode[] = positionColumn(
    sources.sort((a, b) => b.value - a.value).slice(0, 15),
    LEFT_X,
    usableHeight,
    maxVal,
    links,
    'source',
  );

  // Position target nodes
  const targetNodes: LayoutNode[] = positionColumn(
    targets.sort((a, b) => b.value - a.value).slice(0, 15),
    RIGHT_X,
    usableHeight,
    maxVal,
    links,
    'target',
  );

  // Build node lookup
  const nodeMap = new Map<string, LayoutNode>();
  for (const n of [...sourceNodes, ...targetNodes]) nodeMap.set(n.id, n);

  // Build links with bezier paths
  const maxLinkVal = Math.max(...links.map((l) => l.value), 1);
  const sourceYOffsets = new Map<string, number>();
  const targetYOffsets = new Map<string, number>();

  const layoutLinks: LayoutLink[] = links
    .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
    .sort((a, b) => b.value - a.value)
    .map((link) => {
      const src = nodeMap.get(link.source)!;
      const tgt = nodeMap.get(link.target)!;

      const width =
        MIN_LINK_WIDTH +
        (Math.log(link.value + 1) / Math.log(maxLinkVal + 1)) *
          (MAX_LINK_WIDTH - MIN_LINK_WIDTH);

      const srcOffset = sourceYOffsets.get(link.source) || 0;
      const tgtOffset = targetYOffsets.get(link.target) || 0;

      const sy = src.y + srcOffset + width / 2;
      const ty = tgt.y + tgtOffset + width / 2;

      sourceYOffsets.set(link.source, srcOffset + width + 1);
      targetYOffsets.set(link.target, tgtOffset + width + 1);

      const cx1 = src.x + NODE_WIDTH + (RIGHT_X - LEFT_X - NODE_WIDTH) * 0.35;
      const cx2 = tgt.x - (RIGHT_X - LEFT_X - NODE_WIDTH) * 0.35;

      const path = `M ${src.x + NODE_WIDTH} ${sy} C ${cx1} ${sy}, ${cx2} ${ty}, ${tgt.x} ${ty}`;

      return {
        key: `${link.source}->${link.target}`,
        path,
        color: FLOW_COLORS[link.type] || FLOW_COLORS.unknown,
        width,
        value: link.value,
        count: link.count,
        source: link.source,
        target: link.target,
        sourceLabel: src.label,
        targetLabel: tgt.label,
        sourceY: sy,
        targetY: ty,
      };
    });

  return { sourceNodes, targetNodes, links: layoutLinks };
}

function positionColumn(
  nodes: FlowNode[],
  x: number,
  usableHeight: number,
  maxVal: number,
  links: FlowLink[],
  side: 'source' | 'target',
): LayoutNode[] {
  const totalNodeValue = nodes.reduce((s, n) => s + n.value, 0);
  const totalPadding = (nodes.length - 1) * NODE_PADDING;
  const availableHeight = usableHeight - totalPadding;

  let y = 20;

  return nodes.map((node) => {
    const proportion = totalNodeValue > 0 ? node.value / totalNodeValue : 1 / nodes.length;
    const height = Math.max(12, proportion * availableHeight);

    // Determine net direction
    const inflow = links
      .filter((l) => l.target === node.id)
      .reduce((s, l) => s + l.value, 0);
    const outflow = links
      .filter((l) => l.source === node.id)
      .reduce((s, l) => s + l.value, 0);

    const layoutNode: LayoutNode = {
      ...node,
      x,
      y,
      height,
      netDirection: inflow >= outflow ? 'inflow' : 'outflow',
    };
    y += height + NODE_PADDING;
    return layoutNode;
  });
}

// ─── Helpers ────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function nodeColor(node: LayoutNode): string {
  switch (node.type) {
    case 'exchange':
      return tokens.semantic.warning;
    case 'contract':
      return tokens.brand.primary;
    default:
      return tokens.semantic.gain;
  }
}

function chainColor(chain: string): string {
  switch (chain) {
    case 'ethereum':
      return '#627EEA';
    case 'bitcoin':
      return '#F7931A';
    case 'solana':
      return '#00FFA3';
    case 'tron':
      return '#FF0013';
    default:
      return tokens.text.muted;
  }
}
