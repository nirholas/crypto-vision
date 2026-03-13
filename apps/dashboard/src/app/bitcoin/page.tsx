/**
 * Bitcoin Intelligence Dashboard
 * 
 * Comprehensive Bitcoin analytics combining 21+ API endpoints:
 * - Market overview (price, market cap, dominance)
 * - Mining stats (hashrate, difficulty, block reward)
 * - Mempool analytics (tx count, fees, congestion)
 * - On-chain metrics (active addresses, transfer volume)
 * - Supply analysis (mined, halving countdown)
 * - Lightning Network stats
 * - Whale & exchange balance tracking
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';
import {
  Bitcoin,
  Activity,
  Cpu,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Database,
  Layers,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Wallet,
  BarChart3,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface BitcoinOverview {
  price: {
    usd: number;
    change24h: number;
    change7d: number;
    change30d: number;
    ath: number | null;
    athDate: string | null;
    marketCap: number;
  } | null;
  onchain: {
    activeAddresses24h: number;
    transactionCount24h: number;
    avgTransactionValue: number;
    totalTransferVolume: number;
  } | null;
  mining: {
    hashRate: number;
    difficulty: number;
    blockReward: number;
    blocksToday: number;
    minerRevenue24h: number;
    nextDifficultyAdjustment: {
      estimatedDate: string;
      blocksRemaining: number;
      percentChange: number;
    } | null;
  } | null;
  mempool: {
    txCount: number;
    totalSizeBytes: number;
    totalFeesBtc: number;
  } | null;
  dominance: number | null;
}

interface MempoolFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

interface LatestBlock {
  height: number;
  hash: string;
  timestamp: number;
  txCount: number;
  size: number;
  weight: number;
}

interface LightningStats {
  nodeCount: number;
  channelCount: number;
  totalCapacity: number;
  avgChannelSize: number;
  medianChannelSize: number;
}

interface HalvingData {
  nextHalving: {
    blocksRemaining: number;
    estimatedDate: string;
    currentReward: number;
    nextReward: number;
  };
  history: Array<{
    event: number;
    block: number;
    date: string;
    reward: number;
  }>;
}

// ============================================
// Formatting
// ============================================

function fmtNum(n: number, decimals = 0): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(decimals > 0 ? decimals : 1)}K`;
  return n.toFixed(decimals);
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: n >= 1e9 ? 'compact' : 'standard',
    maximumFractionDigits: n >= 1e9 ? 2 : 0,
  }).format(n);
}

function fmtBTC(sats: number): string {
  return `${(sats / 1e8).toFixed(4)} BTC`;
}

// ============================================
// Stat Card
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  color = 'text-primary',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  subtitle?: string;
  trend?: number;
  color?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-gain' : 'text-loss'}`}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-xl font-bold text-text-primary font-mono">{value}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================
// Section Component
// ============================================

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
      <div className="p-5 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-amber-500/10 rounded-lg">
            <Icon className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ============================================
// Fee Gauge
// ============================================

function FeeGauge({ fees }: { fees: MempoolFees }) {
  const levels = [
    { label: 'Priority', fee: fees.fastestFee, color: 'bg-red-500', time: '~10 min' },
    { label: 'Standard', fee: fees.halfHourFee, color: 'bg-amber-500', time: '~30 min' },
    { label: 'Economy', fee: fees.hourFee, color: 'bg-green-500', time: '~60 min' },
    { label: 'Minimum', fee: fees.minimumFee, color: 'bg-blue-500', time: '~hours' },
  ];

  const maxFee = Math.max(...levels.map((l) => l.fee), 1);

  return (
    <div className="space-y-3">
      {levels.map((level) => (
        <div key={level.label} className="flex items-center gap-3">
          <span className="text-xs text-text-secondary w-16">{level.label}</span>
          <div className="flex-1 h-3 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className={`h-full ${level.color} rounded-full transition-all duration-500`}
              style={{ width: `${(level.fee / maxFee) * 100}%` }}
            />
          </div>
          <span className="text-xs text-text-primary font-mono w-16 text-right">
            {level.fee} sat/vB
          </span>
          <span className="text-xs text-text-muted w-14 text-right">{level.time}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Page Component
// ============================================

export default function BitcoinPage() {
  const [overview, setOverview] = useState<BitcoinOverview | null>(null);
  const [fees, setFees] = useState<MempoolFees | null>(null);
  const [blocks, setBlocks] = useState<LatestBlock[]>([]);
  const [lightning, setLightning] = useState<LightningStats | null>(null);
  const [halving, setHalving] = useState<HalvingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, feesRes, blocksRes, lightningRes, halvingRes] =
        await Promise.allSettled([
          fetch('/api/bitcoin/overview'),
          fetch('/api/bitcoin/fees'),
          fetch('/api/bitcoin/blocks/latest'),
          fetch('/api/bitcoin/lightning'),
          fetch('/api/bitcoin/halving'),
        ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
        const data = await overviewRes.value.json();
        setOverview(data.data || null);
      }
      if (feesRes.status === 'fulfilled' && feesRes.value.ok) {
        const data = await feesRes.value.json();
        setFees(data.data || data || null);
      }
      if (blocksRes.status === 'fulfilled' && blocksRes.value.ok) {
        const data = await blocksRes.value.json();
        setBlocks(Array.isArray(data.data) ? data.data.slice(0, 10) : []);
      }
      if (lightningRes.status === 'fulfilled' && lightningRes.value.ok) {
        const data = await lightningRes.value.json();
        setLightning(data.data || null);
      }
      if (halvingRes.status === 'fulfilled' && halvingRes.value.ok) {
        const data = await halvingRes.value.json();
        setHalving(data.data || null);
      }
    } catch {
      // Data will show empty states
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Compute ATH distance
  const athDistance = useMemo(() => {
    if (!overview?.price?.usd || !overview.price.ath) return null;
    return ((overview.price.usd - overview.price.ath) / overview.price.ath) * 100;
  }, [overview]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl">
                <Bitcoin className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text-primary">Bitcoin Intelligence</h1>
                <p className="text-text-secondary mt-1">
                  Comprehensive on-chain analytics, mining, mempool, and network health
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-surface-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <ShareButtons
                url="/bitcoin"
                title="Bitcoin Intelligence Dashboard — Mining, Mempool, On-Chain Analytics ₿"
                variant="compact"
              />
            </div>
          </div>
        </div>

        {/* Price & Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface rounded-xl border border-surface-border p-4 animate-pulse"
              >
                <div className="h-3 w-20 bg-surface-elevated rounded mb-3" />
                <div className="h-6 w-16 bg-surface-elevated rounded" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                icon={Bitcoin}
                label="BTC Price"
                value={overview?.price ? fmtUSD(overview.price.usd) : '—'}
                trend={overview?.price?.change24h}
                color="text-amber-400"
              />
              <StatCard
                icon={BarChart3}
                label="Market Cap"
                value={overview?.price?.marketCap ? fmtUSD(overview.price.marketCap) : '—'}
                color="text-amber-400"
              />
              <StatCard
                icon={TrendingUp}
                label="Dominance"
                value={overview?.dominance ? `${overview.dominance.toFixed(1)}%` : '—'}
                color="text-amber-400"
              />
              <StatCard
                icon={Activity}
                label="7D Change"
                value={
                  overview?.price?.change7d ? `${overview.price.change7d.toFixed(1)}%` : '—'
                }
                trend={overview?.price?.change7d}
                color="text-primary"
              />
              <StatCard
                icon={TrendingDown}
                label="ATH Distance"
                value={athDistance !== null ? `${athDistance.toFixed(1)}%` : '—'}
                subtitle={overview?.price?.ath ? fmtUSD(overview.price.ath) : undefined}
                color="text-loss"
              />
              <StatCard
                icon={Shield}
                label="30D Change"
                value={
                  overview?.price?.change30d ? `${overview.price.change30d.toFixed(1)}%` : '—'
                }
                trend={overview?.price?.change30d}
                color="text-primary"
              />
            </>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Mining Stats */}
          <Section icon={Cpu} title="Mining" description="Hash rate, difficulty, block rewards">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 bg-surface-elevated rounded animate-pulse" />
                ))}
              </div>
            ) : overview?.mining ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-text-muted mb-1">Hash Rate</p>
                    <p className="text-lg font-bold text-text-primary font-mono">
                      {fmtNum(overview.mining.hashRate)} EH/s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Difficulty</p>
                    <p className="text-lg font-bold text-text-primary font-mono">
                      {fmtNum(overview.mining.difficulty)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Block Reward</p>
                    <p className="text-lg font-bold text-text-primary font-mono">
                      {overview.mining.blockReward} BTC
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted mb-1">Blocks Today</p>
                    <p className="text-lg font-bold text-text-primary font-mono">
                      {overview.mining.blocksToday}
                    </p>
                  </div>
                </div>
                <div className="pt-3 border-t border-surface-border">
                  <p className="text-xs text-text-muted mb-1">Miner Revenue (24h)</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtBTC(overview.mining.minerRevenue24h)}
                  </p>
                </div>
                {overview.mining.nextDifficultyAdjustment && (
                  <div className="pt-3 border-t border-surface-border">
                    <p className="text-xs text-text-muted mb-1">Next Difficulty Adjustment</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-text-primary">
                        {overview.mining.nextDifficultyAdjustment.blocksRemaining} blocks
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          overview.mining.nextDifficultyAdjustment.percentChange >= 0
                            ? 'text-gain'
                            : 'text-loss'
                        }`}
                      >
                        {overview.mining.nextDifficultyAdjustment.percentChange >= 0 ? '+' : ''}
                        {overview.mining.nextDifficultyAdjustment.percentChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-8">Mining data unavailable</p>
            )}
          </Section>

          {/* Mempool & Fees */}
          <Section icon={Database} title="Mempool & Fees" description="Transaction backlog and fee estimates">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 bg-surface-elevated rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {overview?.mempool && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-text-muted mb-1">Pending TXs</p>
                      <p className="text-lg font-bold text-text-primary font-mono">
                        {fmtNum(overview.mempool.txCount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted mb-1">Mempool Size</p>
                      <p className="text-lg font-bold text-text-primary font-mono">
                        {fmtNum(overview.mempool.totalSizeBytes / 1e6, 1)} MB
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted mb-1">Total Fees</p>
                      <p className="text-lg font-bold text-text-primary font-mono">
                        {(overview.mempool.totalFeesBtc / 1e8).toFixed(2)} BTC
                      </p>
                    </div>
                  </div>
                )}
                {fees && (
                  <div className="pt-3 border-t border-surface-border">
                    <p className="text-xs text-text-muted mb-3 font-medium">Fee Estimates</p>
                    <FeeGauge fees={fees} />
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* On-Chain Metrics */}
          <Section icon={Activity} title="On-Chain Activity" description="Network usage and transfer volume">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 bg-surface-elevated rounded animate-pulse" />
                ))}
              </div>
            ) : overview?.onchain ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-muted mb-1">Active Addresses (24h)</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtNum(overview.onchain.activeAddresses24h)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Transactions (24h)</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtNum(overview.onchain.transactionCount24h)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Avg TX Value</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtBTC(overview.onchain.avgTransactionValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Transfer Volume (24h)</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtBTC(overview.onchain.totalTransferVolume)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-8">
                On-chain data unavailable
              </p>
            )}
          </Section>

          {/* Lightning Network */}
          <Section icon={Zap} title="Lightning Network" description="Layer 2 payment network stats">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-6 bg-surface-elevated rounded animate-pulse" />
                ))}
              </div>
            ) : lightning ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-muted mb-1">Nodes</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtNum(lightning.nodeCount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Channels</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtNum(lightning.channelCount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Total Capacity</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtBTC(lightning.totalCapacity)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Avg Channel Size</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {fmtBTC(lightning.avgChannelSize)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-8">
                Lightning data unavailable
              </p>
            )}
          </Section>
        </div>

        {/* Latest Blocks */}
        <Section icon={Layers} title="Latest Blocks" description="Most recent Bitcoin blocks">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-surface-elevated rounded animate-pulse" />
              ))}
            </div>
          ) : blocks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-xs uppercase tracking-wider">
                    <th className="text-left pb-3 font-medium">Height</th>
                    <th className="text-left pb-3 font-medium">Hash</th>
                    <th className="text-right pb-3 font-medium">TXs</th>
                    <th className="text-right pb-3 font-medium">Size</th>
                    <th className="text-right pb-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {blocks.map((block) => (
                    <tr key={block.height} className="hover:bg-surface-elevated/50 transition-colors">
                      <td className="py-2.5 font-mono text-primary font-medium">
                        {block.height.toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-text-secondary text-xs">
                        {block.hash.slice(0, 8)}…{block.hash.slice(-8)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-text-primary">
                        {block.txCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right font-mono text-text-secondary">
                        {(block.size / 1e6).toFixed(2)} MB
                      </td>
                      <td className="py-2.5 text-right text-text-muted text-xs">
                        {new Date(block.timestamp * 1000).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-8">No block data available</p>
          )}
        </Section>

        {/* Halving Countdown */}
        {halving?.nextHalving && (
          <div className="mt-6">
            <Section
              icon={Clock}
              title="Halving Countdown"
              description={`Next halving: ${halving.nextHalving.currentReward} → ${halving.nextHalving.nextReward} BTC`}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-text-muted mb-1">Blocks Remaining</p>
                  <p className="text-2xl font-bold text-amber-400 font-mono">
                    {halving.nextHalving.blocksRemaining.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Estimated Date</p>
                  <p className="text-lg font-bold text-text-primary">
                    {new Date(halving.nextHalving.estimatedDate).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Current Reward</p>
                  <p className="text-lg font-bold text-text-primary font-mono">
                    {halving.nextHalving.currentReward} BTC
                  </p>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-1">Next Reward</p>
                  <p className="text-lg font-bold text-amber-400 font-mono">
                    {halving.nextHalving.nextReward} BTC
                  </p>
                </div>
              </div>
              {halving.history && halving.history.length > 0 && (
                <div className="mt-4 pt-4 border-t border-surface-border">
                  <p className="text-xs text-text-muted font-medium mb-2">Halving History</p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {halving.history.map((h) => (
                      <div
                        key={h.event}
                        className="flex-shrink-0 px-3 py-2 bg-surface-elevated rounded-lg text-xs"
                      >
                        <span className="text-amber-400 font-bold">#{h.event}</span>
                        <span className="text-text-muted ml-2">
                          Block {h.block.toLocaleString()}
                        </span>
                        <span className="text-text-muted ml-2">→ {h.reward} BTC</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
