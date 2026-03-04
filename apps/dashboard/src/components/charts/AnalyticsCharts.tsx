/**
 * Advanced Analytics Charts
 * 
 * Drawdown curve, Sharpe ratio over time, regime indicator,
 * correlation heatmap (SVG), and risk-adjusted performance charts.
 * 
 * Inspired by Giza Tech's portfolio analytics patterns.
 */

'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { chartColors, tokens } from '@/lib/colors';

// ============================================
// Drawdown Curve
// ============================================

interface DrawdownPoint {
  time: string;
  drawdown: number; // Negative percentage (e.g., -15 = 15% drawdown)
  price?: number;
}

interface DrawdownChartProps {
  data: DrawdownPoint[];
  height?: number;
  className?: string;
}

export function DrawdownChart({ data, height = 200, className }: DrawdownChartProps) {
  const maxDrawdown = useMemo(() => {
    return Math.min(...data.map((d) => d.drawdown));
  }, [data]);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.semantic.loss} stopOpacity={0} />
              <stop offset="100%" stopColor={tokens.semantic.loss} stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: chartColors.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: chartColors.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v.toFixed(0)}%`}
            domain={[maxDrawdown * 1.1, 0]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const data = payload[0].payload as DrawdownPoint;
              return (
                <div className="bg-surface border border-surface-border rounded-lg p-2.5 shadow-xl text-xs">
                  <p className="text-text-muted mb-1">{data.time}</p>
                  <p className="text-loss font-mono font-medium">{data.drawdown.toFixed(2)}%</p>
                  {data.price !== undefined && (
                    <p className="text-text-secondary mt-0.5">${data.price.toLocaleString()}</p>
                  )}
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke={chartColors.axis} strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="drawdown"
            stroke={tokens.semantic.loss}
            strokeWidth={1.5}
            fill="url(#drawdownGradient)"
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// Sharpe Ratio Over Time
// ============================================

interface SharpePoint {
  time: string;
  sharpe: number;
}

interface SharpeChartProps {
  data: SharpePoint[];
  height?: number;
  className?: string;
}

export function SharpeChart({ data, height = 200, className }: SharpeChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: chartColors.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: chartColors.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => v.toFixed(1)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const pt = payload[0].payload as SharpePoint;
              const quality =
                pt.sharpe >= 2 ? 'Excellent' : pt.sharpe >= 1 ? 'Good' : pt.sharpe >= 0 ? 'Poor' : 'Negative';
              return (
                <div className="bg-surface border border-surface-border rounded-lg p-2.5 shadow-xl text-xs">
                  <p className="text-text-muted mb-1">{pt.time}</p>
                  <p className="text-text-primary font-mono font-medium">Sharpe: {pt.sharpe.toFixed(2)}</p>
                  <p className="text-text-muted">{quality}</p>
                </div>
              );
            }}
          />
          <ReferenceLine y={1} stroke={tokens.semantic.gain} strokeDasharray="5 5" opacity={0.5} label={{ value: 'Good', fill: tokens.text.muted, fontSize: 10 }} />
          <ReferenceLine y={0} stroke={chartColors.axis} strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="sharpe"
            stroke={tokens.brand.primary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: tokens.brand.primary }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// Market Regime Indicator
// ============================================

type Regime = 'bull' | 'bear' | 'accumulation' | 'distribution';

interface RegimePoint {
  time: string;
  regime: Regime;
  confidence: number; // 0-100
  price?: number;
}

interface RegimeChartProps {
  data: RegimePoint[];
  height?: number;
  className?: string;
}

const REGIME_COLORS: Record<Regime, string> = {
  bull: tokens.semantic.gain,
  bear: tokens.semantic.loss,
  accumulation: tokens.semantic.info,
  distribution: tokens.semantic.warning,
};

export function RegimeChart({ data, height = 100, className }: RegimeChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis
            dataKey="time"
            tick={{ fill: chartColors.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const pt = payload[0].payload as RegimePoint;
              return (
                <div className="bg-surface border border-surface-border rounded-lg p-2.5 shadow-xl text-xs">
                  <p className="text-text-muted mb-1">{pt.time}</p>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: REGIME_COLORS[pt.regime] }}
                    />
                    <span className="text-text-primary capitalize font-medium">{pt.regime}</span>
                  </div>
                  <p className="text-text-muted mt-0.5">Confidence: {pt.confidence}%</p>
                </div>
              );
            }}
          />
          <Bar dataKey="confidence" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={REGIME_COLORS[entry.regime]} opacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-text-muted">
        {(Object.entries(REGIME_COLORS) as [Regime, string][]).map(([regime, color]) => (
          <span key={regime} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="capitalize">{regime}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SVG Correlation Heatmap
// ============================================

interface CorrelationHeatmapProps {
  symbols: string[];
  matrix: number[][]; // n x n correlation matrix (-1 to 1)
  height?: number;
  className?: string;
}

function correlationToColor(value: number): string {
  const clamped = Math.max(-1, Math.min(1, value));
  if (clamped >= 0) {
    // Positive: green scale
    const intensity = Math.floor(clamped * 200);
    return `rgb(${22 + (255 - 22) * (1 - clamped)}, ${Math.min(199, 80 + intensity)}, ${132 * clamped + 80 * (1 - clamped)})`;
  } else {
    // Negative: red scale
    const intensity = Math.abs(clamped);
    return `rgb(${Math.min(234, 80 + intensity * 154)}, ${Math.max(57, 80 - intensity * 23)}, ${Math.max(67, 80 - intensity * 13)})`;
  }
}

export function CorrelationHeatmap({ symbols, matrix, className }: CorrelationHeatmapProps) {
  const cellSize = 48;
  const labelWidth = 60;
  const totalWidth = labelWidth + symbols.length * cellSize;
  const totalHeight = labelWidth + symbols.length * cellSize;

  return (
    <div className={`overflow-x-auto ${className ?? ''}`}>
      <svg width={totalWidth} height={totalHeight} className="mx-auto">
        {/* Column labels */}
        {symbols.map((sym, i) => (
          <text
            key={`col-${i}`}
            x={labelWidth + i * cellSize + cellSize / 2}
            y={labelWidth - 8}
            textAnchor="middle"
            className="fill-text-muted text-[10px] font-mono uppercase"
          >
            {sym.slice(0, 5)}
          </text>
        ))}

        {/* Row labels + cells */}
        {symbols.map((rowSym, row) => (
          <g key={`row-${row}`}>
            <text
              x={labelWidth - 8}
              y={labelWidth + row * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              className="fill-text-muted text-[10px] font-mono uppercase"
            >
              {rowSym.slice(0, 5)}
            </text>

            {symbols.map((_colSym, col) => {
              const value = matrix[row]?.[col] ?? 0;
              return (
                <g key={`cell-${row}-${col}`}>
                  <rect
                    x={labelWidth + col * cellSize + 1}
                    y={labelWidth + row * cellSize + 1}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    rx={3}
                    fill={correlationToColor(value)}
                    opacity={row === col ? 0.3 : 0.85}
                    className="transition-opacity hover:opacity-100"
                  />
                  <text
                    x={labelWidth + col * cellSize + cellSize / 2}
                    y={labelWidth + row * cellSize + cellSize / 2 + 3}
                    textAnchor="middle"
                    className="fill-text-primary text-[10px] font-mono font-medium pointer-events-none"
                  >
                    {value.toFixed(2)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Color scale legend */}
        <defs>
          <linearGradient id="heatmapScale" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={correlationToColor(-1)} />
            <stop offset="50%" stopColor={correlationToColor(0)} />
            <stop offset="100%" stopColor={correlationToColor(1)} />
          </linearGradient>
        </defs>
      </svg>

      {/* Color scale */}
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-text-muted">
        <span>-1.0</span>
        <div
          className="w-32 h-3 rounded-full"
          style={{
            background: `linear-gradient(to right, ${correlationToColor(-1)}, ${correlationToColor(0)}, ${correlationToColor(1)})`,
          }}
        />
        <span>+1.0</span>
      </div>
    </div>
  );
}

// ============================================
// Risk Radar Chart
// ============================================

interface RiskMetric {
  metric: string;
  value: number; // 0-100 normalized
  fullMark?: number;
}

interface RiskRadarProps {
  data: RiskMetric[];
  height?: number;
  className?: string;
}

export function RiskRadar({ data, height = 300, className }: RiskRadarProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke={chartColors.grid} />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: tokens.text.muted, fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: chartColors.axis, fontSize: 9 }}
          />
          <Radar
            name="Risk Profile"
            dataKey="value"
            stroke={tokens.brand.primary}
            fill={tokens.brand.primary}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// Yield / APR Tracker (Giza-inspired)
// ============================================

interface YieldPoint {
  time: string;
  apr?: number;
  tvl?: number;
  protocol?: string;
  [key: string]: string | number | undefined;
}

interface YieldChartProps {
  data: YieldPoint[];
  protocols?: {
    dataKey: string;
    name: string;
    color: string;
  }[];
  height?: number;
  className?: string;
  showTVL?: boolean;
}

export function YieldChart({
  data,
  protocols,
  height = 300,
  className,
  showTVL = false,
}: YieldChartProps) {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.3} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fill: chartColors.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="apr"
            tick={{ fill: chartColors.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            domain={['auto', 'auto']}
          />
          {showTVL && (
            <YAxis
              yAxisId="tvl"
              orientation="right"
              tick={{ fill: chartColors.axis, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => {
                if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
                if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
                return `$${v.toLocaleString()}`;
              }}
            />
          )}
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="bg-surface border border-surface-border rounded-lg p-2.5 shadow-xl text-xs">
                  <p className="text-text-muted mb-1.5">{label}</p>
                  {payload.map((entry, i) => (
                    <p key={i} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-text-secondary">{entry.name}:</span>
                      <span className="text-text-primary font-mono font-medium">
                        {entry.dataKey === 'tvl'
                          ? `$${((entry.value as number) / 1e6).toFixed(1)}M`
                          : `${(entry.value as number).toFixed(2)}%`}
                      </span>
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ paddingTop: 16 }} iconType="circle" />

          {protocols ? (
            protocols.map((p) => (
              <Line
                key={p.dataKey}
                yAxisId="apr"
                type="monotone"
                dataKey={p.dataKey}
                name={p.name}
                stroke={p.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            ))
          ) : (
            <Line
              yAxisId="apr"
              type="monotone"
              dataKey="apr"
              name="APR"
              stroke={tokens.semantic.gain}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          )}

          {showTVL && (
            <Area
              yAxisId="tvl"
              type="monotone"
              dataKey="tvl"
              name="TVL"
              stroke={tokens.brand.primary}
              fill={`${tokens.brand.primary}15`}
              strokeWidth={1}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================
// Exports
// ============================================

export { REGIME_COLORS };
