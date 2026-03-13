/**
 * Anomaly Detection Dashboard
 * 
 * Real-time anomaly detection across crypto markets:
 * - Live anomaly event feed with severity filtering
 * - Detection engine statistics
 * - SSE streaming for real-time updates
 * - Anomaly type breakdown with visual indicators
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';
import {
  AlertTriangle,
  Activity,
  Zap,
  Shield,
  TrendingUp,
  TrendingDown,
  Radio,
  Filter,
  RefreshCw,
  Circle,
  ChevronDown,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface AnomalyEvent {
  id: string;
  type: string;
  asset: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface AnomalyStats {
  totalDetected: number;
  activeDetectors: number;
  recentEvents: number;
  severityCounts: {
    critical: number;
    warning: number;
    info: number;
  };
  topAssets: Array<{ asset: string; count: number }>;
  topTypes: Array<{ type: string; count: number }>;
}

// ============================================
// Constants
// ============================================

const SEVERITY_CONFIG = {
  critical: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-500',
    label: 'Critical',
  },
  warning: {
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
    label: 'Warning',
  },
  info: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500',
    label: 'Info',
  },
} as const;

const ANOMALY_TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  price_spike: TrendingUp,
  volume_surge: Activity,
  flash_crash: TrendingDown,
  pump_and_dump: Zap,
  whale_movement: Shield,
  exchange_flow: Activity,
  social_spike: Radio,
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  price_spike: 'Price Spike',
  volume_surge: 'Volume Surge',
  flash_crash: 'Flash Crash',
  pump_and_dump: 'Pump & Dump',
  whale_movement: 'Whale Movement',
  exchange_flow: 'Exchange Flow',
  social_spike: 'Social Spike',
  correlation_break: 'Correlation Break',
  funding_rate: 'Funding Rate',
  liquidation_cascade: 'Liquidation Cascade',
  mempool_anomaly: 'Mempool Anomaly',
  stablecoin_depeg: 'Stablecoin Depeg',
  governance_attack: 'Governance Attack',
  smart_contract_exploit: 'Smart Contract',
  network_congestion: 'Network Congestion',
  mining_disruption: 'Mining Disruption',
};

// ============================================
// Stat Card
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color = 'text-primary',
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold text-text-primary font-mono">{String(value)}</p>
      {subtitle && <p className="text-xs text-text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

// ============================================
// Anomaly Event Row
// ============================================

function AnomalyEventRow({ event }: { event: AnomalyEvent }) {
  const severity = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.info;
  const TypeIcon = ANOMALY_TYPE_ICONS[event.type] || AlertTriangle;
  const typeLabel = ANOMALY_TYPE_LABELS[event.type] || event.type.replace(/_/g, ' ');
  const timeSince = getTimeSince(event.timestamp);

  return (
    <div
      className={`p-4 rounded-lg border ${severity.border} ${severity.bg} hover:brightness-110 transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-1.5 rounded-lg ${severity.bg} flex-shrink-0 mt-0.5`}>
            <TypeIcon className={`w-4 h-4 ${severity.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-text-primary text-sm">{event.asset}</span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${severity.bg} ${severity.color} uppercase tracking-wider`}
              >
                {severity.label}
              </span>
              <span className="text-xs text-text-muted font-medium">{typeLabel}</span>
            </div>
            <p className="text-sm text-text-secondary mt-1 line-clamp-2">{event.message}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
              <span>
                Value: <span className="text-text-primary font-mono">{event.value.toFixed(2)}</span>
              </span>
              <span>
                Threshold:{' '}
                <span className="text-text-primary font-mono">{event.threshold.toFixed(2)}</span>
              </span>
            </div>
          </div>
        </div>
        <span className="text-xs text-text-muted whitespace-nowrap flex-shrink-0">{timeSince}</span>
      </div>
    </div>
  );
}

// ============================================
// Anomaly Type Bar
// ============================================

function AnomalyTypeBar({ types }: { types: Array<{ type: string; count: number }> }) {
  const maxCount = Math.max(...types.map((t) => t.count), 1);

  return (
    <div className="space-y-2">
      {types.map((t) => {
        const label = ANOMALY_TYPE_LABELS[t.type] || t.type.replace(/_/g, ' ');
        const pct = (t.count / maxCount) * 100;
        return (
          <div key={t.type} className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-28 truncate">{label}</span>
            <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-text-muted font-mono w-8 text-right">{t.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function getTimeSince(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ============================================
// Page Component
// ============================================

export default function AnomaliesPage() {
  const [events, setEvents] = useState<AnomalyEvent[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.allSettled([
        fetch('/api/anomalies?limit=100'),
        fetch('/api/anomalies/stats'),
      ]);

      if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
        const data = await eventsRes.value.json();
        setEvents(data.data || []);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const data = await statsRes.value.json();
        setStats(data.data || null);
      }
    } catch {
      // Silently handle — data will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE streaming for real-time updates
  const toggleStreaming = useCallback(() => {
    if (streaming && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setStreaming(false);
      return;
    }

    const es = new EventSource('/api/anomalies/stream');
    es.onmessage = (event) => {
      try {
        const anomaly: AnomalyEvent = JSON.parse(event.data);
        setEvents((prev) => [anomaly, ...prev].slice(0, 200));
        // Update stats severity counts
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalDetected: prev.totalDetected + 1,
            recentEvents: prev.recentEvents + 1,
            severityCounts: {
              ...prev.severityCounts,
              [anomaly.severity]: (prev.severityCounts[anomaly.severity] || 0) + 1,
            },
          };
        });
      } catch {
        // Ignore malformed events
      }
    };
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      setStreaming(false);
    };
    eventSourceRef.current = es;
    setStreaming(true);
  }, [streaming]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Filter events
  const filteredEvents = events.filter((e) => {
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    return true;
  });

  // Get unique types from events
  const eventTypes = [...new Set(events.map((e) => e.type))].sort();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-text-primary">Anomaly Detection</h1>
                <p className="text-text-secondary mt-1">
                  Real-time market anomalies — price spikes, whale movements, flash crashes, and
                  more
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleStreaming}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  streaming
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20'
                }`}
              >
                <Radio className={`w-3.5 h-3.5 ${streaming ? 'animate-pulse' : ''}`} />
                {streaming ? 'Live' : 'Go Live'}
              </button>
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-surface-border text-text-secondary hover:text-text-primary transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <ShareButtons
                url="/anomalies"
                title="Crypto Anomaly Detection Dashboard — Real-time Market Intelligence 🔍"
                variant="compact"
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
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
                icon={AlertTriangle}
                label="Total Detected"
                value={stats?.totalDetected || 0}
                subtitle="All time anomalies"
                color="text-primary"
              />
              <StatCard
                icon={Zap}
                label="Critical"
                value={stats?.severityCounts.critical || 0}
                subtitle="Requires attention"
                color="text-red-400"
              />
              <StatCard
                icon={AlertTriangle}
                label="Warnings"
                value={stats?.severityCounts.warning || 0}
                subtitle="Elevated signals"
                color="text-amber-400"
              />
              <StatCard
                icon={Activity}
                label="Active Detectors"
                value={stats?.activeDetectors || 16}
                subtitle="Running algorithms"
                color="text-green-400"
              />
              <StatCard
                icon={Shield}
                label="Recent Events"
                value={stats?.recentEvents || events.length}
                subtitle="In buffer"
                color="text-blue-400"
              />
            </>
          )}
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Event Feed */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
              <div className="p-4 border-b border-surface-border">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    Event Feed
                    {streaming && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <Circle className="w-2 h-2 fill-current animate-pulse" />
                        LIVE
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Severity filter */}
                    <div className="relative">
                      <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="appearance-none bg-surface-elevated text-text-secondary text-xs px-3 py-1.5 pr-7 rounded-lg border border-surface-border focus:outline-none focus:border-primary/50"
                      >
                        <option value="all">All Severity</option>
                        <option value="critical">Critical</option>
                        <option value="warning">Warning</option>
                        <option value="info">Info</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
                    </div>
                    {/* Type filter */}
                    <div className="relative">
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="appearance-none bg-surface-elevated text-text-secondary text-xs px-3 py-1.5 pr-7 rounded-lg border border-surface-border focus:outline-none focus:border-primary/50"
                      >
                        <option value="all">All Types</option>
                        {eventTypes.map((t) => (
                          <option key={t} value={t}>
                            {ANOMALY_TYPE_LABELS[t] || t}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 bg-surface-elevated rounded-lg animate-pulse"
                    />
                  ))
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-16">
                    <Shield className="w-12 h-12 text-text-muted mx-auto mb-3" />
                    <p className="text-text-secondary font-medium">No anomalies detected</p>
                    <p className="text-text-muted text-sm mt-1">
                      {events.length === 0
                        ? 'The detection engine is warming up — anomalies will appear here as they are detected.'
                        : 'No events match your current filters.'}
                    </p>
                  </div>
                ) : (
                  filteredEvents.slice(0, 50).map((event, i) => (
                    <AnomalyEventRow key={event.id || `${event.type}-${event.timestamp}-${i}`} event={event} />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Assets */}
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
              <div className="p-4 border-b border-surface-border">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Most Anomalous Assets
                </h3>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-4 bg-surface-elevated rounded animate-pulse" />
                    ))}
                  </div>
                ) : stats?.topAssets && stats.topAssets.length > 0 ? (
                  <div className="space-y-2.5">
                    {stats.topAssets.slice(0, 10).map((item, i) => (
                      <div key={item.asset} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-muted font-mono w-4">
                            {i + 1}.
                          </span>
                          <span className="text-sm font-medium text-text-primary">
                            {item.asset}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted font-mono">
                          {item.count} events
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted text-center py-4">
                    No asset data yet
                  </p>
                )}
              </div>
            </div>

            {/* Anomaly Type Breakdown */}
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
              <div className="p-4 border-b border-surface-border">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  Anomaly Types
                </h3>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-4 bg-surface-elevated rounded animate-pulse" />
                    ))}
                  </div>
                ) : stats?.topTypes && stats.topTypes.length > 0 ? (
                  <AnomalyTypeBar types={stats.topTypes} />
                ) : (
                  <p className="text-sm text-text-muted text-center py-4">
                    No type data yet
                  </p>
                )}
              </div>
            </div>

            {/* Severity Distribution */}
            <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
              <div className="p-4 border-b border-surface-border">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-primary" />
                  Severity Distribution
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {(['critical', 'warning', 'info'] as const).map((sev) => {
                  const config = SEVERITY_CONFIG[sev];
                  const count = stats?.severityCounts[sev] || 0;
                  const total =
                    (stats?.severityCounts.critical || 0) +
                    (stats?.severityCounts.warning || 0) +
                    (stats?.severityCounts.info || 0);
                  const pct = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={sev} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                      <span className="text-xs text-text-secondary w-16 capitalize">{sev}</span>
                      <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${config.dot} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-muted font-mono w-8 text-right">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detection Engine Info */}
            <div className="bg-surface rounded-2xl border border-surface-border p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Detection Engine</h3>
              <div className="space-y-2 text-xs text-text-muted">
                <div className="flex justify-between">
                  <span>Algorithm</span>
                  <span className="text-text-primary font-mono">Modified Z-Score + EWMA</span>
                </div>
                <div className="flex justify-between">
                  <span>Detectors</span>
                  <span className="text-text-primary font-mono">16 active</span>
                </div>
                <div className="flex justify-between">
                  <span>Anomaly Types</span>
                  <span className="text-text-primary font-mono">{Object.keys(ANOMALY_TYPE_LABELS).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Buffer Size</span>
                  <span className="text-text-primary font-mono">500 events</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
