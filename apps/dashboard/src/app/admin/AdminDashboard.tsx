'use client';

import { useState, useEffect, useCallback } from 'react';
import { UsageChart, TierDistribution } from '@/components/admin/UsageChart';
import {
  Activity,
  Key,
  Server,
  RefreshCw,
  Search,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Zap,
  TrendingUp,
  Clock,
  Database,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  X,
  DollarSign,
  Users,
  BarChart3,
  Shield,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalCalls: number;
  callsToday: number;
  uniqueUsersToday: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: { endpoint: string; calls: number }[];
  callsByHour: { hour: string; calls: number }[];
  errorsByEndpoint: { endpoint: string; count: number }[];
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  services: {
    name: string;
    status: 'up' | 'down' | 'degraded';
    lastCheck: string;
    responseTime?: number;
  }[];
}

interface FullData {
  stats: DashboardStats;
  health: SystemHealth;
}

interface KeyStats {
  total: number;
  byTier: { free: number; pro: number; enterprise: number };
  active24h: number;
  active7d: number;
  active30d: number;
  totalRequestsToday: number;
  totalRequestsMonth: number;
  topKeys: {
    id: string;
    keyPrefix: string;
    email: string;
    tier: string;
    usageToday: number;
    usageMonth: number;
    lastUsedAt?: string;
  }[];
  usageByDay: { date: string; requests: number }[];
}

interface ApiKeyListItem {
  id: string;
  keyPrefix: string;
  name: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  permissions: string[];
  rateLimit: number;
  usageToday: number;
  usageMonth: number;
  createdAt: string;
  lastUsedAt?: string;
  active: boolean;
}

interface KeysResponse {
  keys: ApiKeyListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface CreateKeyForm {
  name: string;
  email: string;
  tier: 'free' | 'pro' | 'enterprise';
  rateLimit: number;
  description: string;
}

type TabType = 'overview' | 'keys' | 'users' | 'system';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  unhealthy: 'bg-red-500',
  up: 'bg-emerald-500',
  down: 'bg-red-500',
};

const TIER_STYLES: Record<string, string> = {
  free: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  pro: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  enterprise: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<FullData | null>(null);
  const [keyStats, setKeyStats] = useState<KeyStats | null>(null);
  const [keysList, setKeysList] = useState<KeysResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Keys list filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchSystemData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin?view=full', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        setAuthenticated(false);
        setError('Invalid token');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch system data');
      const result = await response.json();
      setData(result);
      setAuthenticated(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [token]);

  const fetchKeyStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setKeyStats(result.stats);
      }
    } catch (err) {
      console.error('Failed to fetch key stats:', err);
    }
  }, [token]);

  const fetchKeysList = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      });
      if (searchQuery) params.set('search', searchQuery);
      if (tierFilter) params.set('tier', tierFilter);
      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/admin/keys?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setKeysList(result);
      }
    } catch (err) {
      console.error('Failed to fetch keys list:', err);
    }
  }, [token, currentPage, searchQuery, tierFilter, statusFilter, sortBy, sortOrder]);

  const fetchAllData = useCallback(async () => {
    setIsRefreshing(true);
    setLoading(true);
    await Promise.all([fetchSystemData(), fetchKeyStats(), fetchKeysList()]);
    setLoading(false);
    setIsRefreshing(false);
    setLastRefresh(new Date());
  }, [fetchSystemData, fetchKeyStats, fetchKeysList]);

  useEffect(() => {
    if (authenticated) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 30_000);
      return () => clearInterval(interval);
    }
  }, [authenticated, fetchAllData]);

  useEffect(() => {
    if (authenticated) {
      fetchKeysList();
    }
  }, [authenticated, currentPage, searchQuery, tierFilter, statusFilter, sortBy, sortOrder, fetchKeysList]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin?view=full', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        setAuthenticated(false);
        setError('Invalid admin token');
        setLoading(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to authenticate');
      const result = await response.json();
      setData(result);
      setAuthenticated(true);
      setError(null);
      setLoading(false);
      setLastRefresh(new Date());
      fetchKeyStats();
      fetchKeysList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      setLoading(false);
    }
  };

  const handleKeyAction = async (keyId: string, action: 'revoke' | 'activate') => {
    try {
      const response = await fetch('/api/admin/keys', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyId, action }),
      });
      if (response.ok) {
        fetchKeysList();
        fetchKeyStats();
      }
    } catch (err) {
      console.error('Failed to update key:', err);
    }
  };

  const handleCreateKey = async (form: CreateKeyForm) => {
    try {
      const response = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        setShowCreateKey(false);
        fetchKeysList();
        fetchKeyStats();
      }
    } catch (err) {
      console.error('Failed to create key:', err);
    }
  };

  // ─── Login Screen ──────────────────────────────────────────────────────────

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--brand)]/10 border border-[var(--brand)]/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-[var(--brand)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Dashboard</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              Enter your admin token to access system controls
            </p>
          </div>
          <form
            onSubmit={handleLogin}
            className="bg-[var(--bg-secondary)] rounded-2xl p-6 border border-[var(--surface-border)] space-y-5"
          >
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                Admin Token
              </label>
              <input
                type="password"
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:border-transparent transition-all"
                placeholder="Enter admin token"
                autoComplete="current-password"
                required
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full py-3 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-black font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Login
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !data && !keyStats) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-[var(--brand)] animate-spin" />
          <p className="text-[var(--text-muted)]">Loading admin data...</p>
        </div>
      </div>
    );
  }

  if (error && !data && !keyStats) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-lg font-medium mb-4">{error}</p>
          <button
            onClick={fetchAllData}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: typeof Activity }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'keys', label: 'API Keys', icon: Key },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'system', label: 'System', icon: Server },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {isRefreshing && (
        <div className="fixed top-0 left-0 right-0 h-0.5 z-50">
          <div className="h-full bg-[var(--brand)] animate-pulse" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
              <Shield className="w-7 h-7 text-[var(--brand)]" />
              Admin Dashboard
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">
              Monitor API usage, manage keys, and system health
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-[var(--text-muted)]">
                Updated {formatRelativeTime(lastRefresh.toISOString())}
              </span>
            )}
            {data?.health && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--surface-border)]">
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[data.health.status] ?? ''}`} />
                <span className="text-xs font-medium text-[var(--text-secondary)] capitalize">
                  {data.health.status}
                </span>
              </div>
            )}
            <button
              onClick={fetchAllData}
              disabled={isRefreshing}
              className="p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-xl border border-[var(--surface-border)] transition-colors disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`w-4 h-4 text-[var(--text-secondary)] ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-[var(--surface-border)] overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-[var(--brand)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand)] rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                icon={<Zap className="w-5 h-5" />}
                iconBg="bg-[var(--brand)]/15"
                iconColor="text-[var(--brand)]"
                label="Requests Today"
                value={formatNumber(keyStats?.totalRequestsToday ?? data?.stats.callsToday ?? 0)}
                change={data?.stats.callsToday ? `${formatNumber(data.stats.totalCalls)} total` : undefined}
              />
              <MetricCard
                icon={<Key className="w-5 h-5" />}
                iconBg="bg-blue-500/15"
                iconColor="text-blue-400"
                label="Active API Keys"
                value={formatNumber(keyStats?.active24h ?? 0)}
                change={keyStats ? `${formatNumber(keyStats.total)} total` : undefined}
              />
              <MetricCard
                icon={<DollarSign className="w-5 h-5" />}
                iconBg="bg-emerald-500/15"
                iconColor="text-emerald-400"
                label="x402 Revenue"
                value="$0.00"
                change="This month"
              />
              <MetricCard
                icon={<AlertTriangle className="w-5 h-5" />}
                iconBg={(data?.stats.errorRate ?? 0) > 5 ? 'bg-red-500/15' : 'bg-emerald-500/15'}
                iconColor={(data?.stats.errorRate ?? 0) > 5 ? 'text-red-400' : 'text-emerald-400'}
                label="Error Rate"
                value={`${data?.stats.errorRate ?? 0}%`}
                change={`Avg ${data?.stats.averageResponseTime ?? 0}ms response`}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {keyStats && <UsageChart data={keyStats.usageByDay} title="Daily API Requests (30d)" />}
              {keyStats && (
                <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Keys by Tier</h3>
                  <TierDistribution free={keyStats.byTier.free} pro={keyStats.byTier.pro} enterprise={keyStats.byTier.enterprise} />
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {data?.health && (
                <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[var(--brand)]" />
                    System Health
                  </h3>
                  <div className="space-y-3">
                    {data.health.services.map((service, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-[var(--surface)]/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[service.status] ?? ''}`} />
                          <span className="text-sm text-[var(--text-primary)]">{service.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {service.responseTime !== undefined && (
                            <span className="text-xs text-[var(--text-muted)]">{service.responseTime}ms</span>
                          )}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            service.status === 'up' ? 'bg-emerald-500/15 text-emerald-400'
                              : service.status === 'degraded' ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}>
                            {service.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data?.stats.topEndpoints && (
                <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[var(--brand)]" />
                    Top Endpoints
                  </h3>
                  <div className="space-y-3">
                    {data.stats.topEndpoints.slice(0, 6).map((ep, i) => {
                      const maxC = data.stats.topEndpoints[0]?.calls ?? 1;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-mono text-[var(--text-secondary)] truncate max-w-[70%]">{ep.endpoint}</span>
                            <span className="text-sm font-medium text-[var(--brand)]">{formatNumber(ep.calls)}</span>
                          </div>
                          <div className="h-1 bg-[var(--surface)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--brand)]/60 rounded-full transition-all" style={{ width: `${(ep.calls / maxC) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {keyStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ActivityCard period="24h" count={keyStats.active24h} color="emerald" />
                <ActivityCard period="7d" count={keyStats.active7d} color="blue" />
                <ActivityCard period="30d" count={keyStats.active30d} color="purple" />
              </div>
            )}

            {data?.stats.errorsByEndpoint && data.stats.errorsByEndpoint.length > 0 && (
              <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Top Errors
                </h3>
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[var(--text-muted)] border-b border-[var(--surface-border)]">
                        <th className="pb-3 font-medium text-sm">Endpoint</th>
                        <th className="pb-3 font-medium text-sm text-right">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stats.errorsByEndpoint.map((err, i) => (
                        <tr key={i} className="border-b border-[var(--surface-border)]/50">
                          <td className="py-3 font-mono text-sm text-[var(--text-secondary)]">{err.endpoint}</td>
                          <td className="py-3 text-right text-red-400 font-medium">{err.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keys Tab */}
        {activeTab === 'keys' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by email, name, or key prefix..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]">
                  <option value="">All Tiers</option>
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]">
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Revoked</option>
                </select>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => { const [by, order] = e.target.value.split('-'); setSortBy(by); setSortOrder(order as 'asc' | 'desc'); setCurrentPage(1); }}
                  className="px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-secondary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                >
                  <option value="createdAt-desc">Newest</option>
                  <option value="createdAt-asc">Oldest</option>
                  <option value="usageMonth-desc">Most Usage</option>
                  <option value="lastUsedAt-desc">Recent Activity</option>
                </select>
                <button
                  onClick={() => setShowCreateKey(true)}
                  className="px-4 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-black font-medium rounded-xl transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create Key
                </button>
              </div>
            </div>

            {keysList ? (
              <>
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--surface-border)] overflow-hidden">
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-[var(--text-muted)] bg-[var(--surface)]/50 text-xs uppercase tracking-wider">
                          <th className="px-4 py-3 font-medium">Key</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Tier</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Rate Limit</th>
                          <th className="px-4 py-3 font-medium text-right">Usage</th>
                          <th className="px-4 py-3 font-medium text-right">Created</th>
                          <th className="px-4 py-3 font-medium text-right">Last Used</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keysList.keys.map((key) => (
                          <KeyRow key={key.id} apiKey={key} onAction={handleKeyAction} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {keysList.keys.length === 0 && (
                    <div className="p-12 text-center">
                      <Key className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
                      <p className="text-[var(--text-muted)]">No API keys found matching your criteria</p>
                    </div>
                  )}
                </div>

                {keysList.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--text-muted)]">
                      Showing {(keysList.pagination.page - 1) * keysList.pagination.limit + 1} - {Math.min(keysList.pagination.page * keysList.pagination.limit, keysList.pagination.total)} of {keysList.pagination.total}
                    </p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage((p) => p - 1)} disabled={!keysList.pagination.hasPrev} className="p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--surface-border)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Previous page">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-3 py-1.5 bg-[var(--surface)] rounded-lg text-sm text-[var(--text-secondary)]">
                        {keysList.pagination.page} / {keysList.pagination.totalPages}
                      </span>
                      <button onClick={() => setCurrentPage((p) => p + 1)} disabled={!keysList.pagination.hasNext} className="p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--surface-border)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next page">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-[var(--bg-secondary)] rounded-xl p-12 border border-[var(--surface-border)] text-center">
                <RefreshCw className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-3 animate-spin" />
                <p className="text-[var(--text-muted)]">Loading API keys...</p>
              </div>
            )}

            {showCreateKey && <CreateKeyModal onClose={() => setShowCreateKey(false)} onCreate={handleCreateKey} />}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[var(--brand)]" />
                User Management
              </h3>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] border-b border-[var(--surface-border)] text-xs uppercase tracking-wider">
                      <th className="pb-3 font-medium">User</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium text-right">Requests (30d)</th>
                      <th className="pb-3 font-medium text-right">Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keyStats?.topKeys.map((key) => (
                      <tr key={key.id} className="border-b border-[var(--surface-border)]/50">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--surface)] flex items-center justify-center text-xs font-medium text-[var(--text-muted)]">
                              {key.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-[var(--text-primary)]">{key.email}</p>
                              <span className="text-xs font-mono text-[var(--text-muted)]">{key.keyPrefix}...</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${TIER_STYLES[key.tier] ?? TIER_STYLES.free}`}>
                            {key.tier}
                          </span>
                        </td>
                        <td className="py-3 text-right text-sm text-[var(--text-secondary)]">{formatNumber(key.usageMonth)}</td>
                        <td className="py-3 text-right text-sm text-[var(--text-muted)]">{key.lastUsedAt ? formatRelativeTime(key.lastUsedAt) : 'Never'}</td>
                      </tr>
                    ))}
                    {(!keyStats?.topKeys || keyStats.topKeys.length === 0) && (
                      <tr><td colSpan={4} className="py-12 text-center text-[var(--text-muted)]">No user activity data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && data && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard icon={<Activity className="w-5 h-5" />} iconBg="bg-[var(--brand)]/15" iconColor="text-[var(--brand)]" label="Total API Calls" value={formatNumber(data.stats.totalCalls)} />
              <MetricCard icon={<Clock className="w-5 h-5" />} iconBg="bg-blue-500/15" iconColor="text-blue-400" label="Avg Response Time" value={`${data.stats.averageResponseTime}ms`} />
              <MetricCard icon={<Users className="w-5 h-5" />} iconBg="bg-purple-500/15" iconColor="text-purple-400" label="Unique Users Today" value={formatNumber(data.stats.uniqueUsersToday)} />
              <MetricCard icon={<Server className="w-5 h-5" />} iconBg="bg-emerald-500/15" iconColor="text-emerald-400" label="Uptime" value={formatUptime(data.health.uptime)} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Calls by Hour (24h)</h3>
                <div className="h-48 flex items-end gap-0.5">
                  {data.stats.callsByHour.map((item, i) => {
                    const maxCalls = Math.max(...data.stats.callsByHour.map((h) => h.calls)) || 1;
                    const height = (item.calls / maxCalls) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center group relative">
                        <div className="w-full bg-[var(--brand)]/60 rounded-t transition-all hover:bg-[var(--brand)]" style={{ height: `${Math.max(height, 2)}%` }} />
                        {i % 4 === 0 && <span className="text-[10px] text-[var(--text-muted)] mt-1">{item.hour}</span>}
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <div className="bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                            <span className="text-[var(--brand)]">{item.calls}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-[var(--brand)]" />
                  System Resources
                </h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-[var(--text-secondary)]">Memory Usage</span>
                      <span className="text-[var(--text-primary)] font-medium">{data.health.memoryUsage.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2.5 bg-[var(--surface)] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${data.health.memoryUsage.percentage > 80 ? 'bg-red-500' : data.health.memoryUsage.percentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${data.health.memoryUsage.percentage}%` }} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{formatBytes(data.health.memoryUsage.used)} / {formatBytes(data.health.memoryUsage.total)}</p>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--surface-border)]">
                    <span className="text-sm text-[var(--text-secondary)]">Error Rate</span>
                    <span className={`text-sm font-medium ${data.stats.errorRate > 5 ? 'text-red-400' : 'text-emerald-400'}`}>{data.stats.errorRate}%</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-[var(--surface-border)]">
                    <span className="text-sm text-[var(--text-secondary)]">Uptime</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{formatUptime(data.health.uptime)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--surface-border)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Wifi className="w-5 h-5 text-[var(--brand)]" />
                External Services
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.health.services.map((service, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-[var(--surface)]/50 rounded-xl border border-[var(--surface-border)]/50">
                    <div className="flex items-center gap-3">
                      {service.status === 'up' ? <Wifi className="w-4 h-4 text-emerald-400" /> : service.status === 'degraded' ? <Wifi className="w-4 h-4 text-amber-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
                      <span className="text-sm text-[var(--text-primary)]">{service.name}</span>
                    </div>
                    {service.responseTime !== undefined && <span className="text-xs text-[var(--text-muted)]">{service.responseTime}ms</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function MetricCard({ icon, iconBg, iconColor, label, value, change }: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  change?: string;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--surface-border)]">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-xs text-[var(--text-muted)] mt-1">{label}</p>
      {change && <p className="text-xs text-[var(--text-muted)] mt-0.5">{change}</p>}
    </div>
  );
}

function ActivityCard({ period, count, color }: { period: string; count: number; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    blue: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
    purple: { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  };
  const c = colors[color] ?? colors.emerald;
  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--surface-border)]">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full ${c.bg} flex items-center justify-center`}>
          <span className={`text-sm font-bold ${c.text}`}>{period}</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
          <p className="text-xs text-[var(--text-muted)]">Active keys ({period})</p>
        </div>
      </div>
    </div>
  );
}

function KeyRow({ apiKey, onAction }: { apiKey: ApiKeyListItem; onAction: (id: string, action: 'revoke' | 'activate') => void }) {
  const [showKey, setShowKey] = useState(false);
  return (
    <tr className="border-t border-[var(--surface-border)] hover:bg-[var(--surface)]/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-[var(--text-secondary)]">{showKey ? apiKey.keyPrefix : `${apiKey.keyPrefix.slice(0, 8)}****`}</span>
          <button onClick={() => setShowKey(!showKey)} className="p-1 rounded hover:bg-[var(--surface)] transition-colors" aria-label={showKey ? 'Hide key' : 'Show key'}>
            {showKey ? <EyeOff className="w-3 h-3 text-[var(--text-muted)]" /> : <Eye className="w-3 h-3 text-[var(--text-muted)]" />}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">{apiKey.name}</p>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{apiKey.email}</td>
      <td className="px-4 py-3">
        <span className={`px-2 py-1 text-[10px] font-semibold rounded-full uppercase border ${TIER_STYLES[apiKey.tier] ?? ''}`}>{apiKey.tier}</span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full ${apiKey.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${apiKey.active ? 'bg-emerald-400' : 'bg-red-400'}`} />
          {apiKey.active ? 'Active' : 'Revoked'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--text-muted)] font-mono">{formatNumber(apiKey.rateLimit)}/min</td>
      <td className="px-4 py-3 text-right">
        <span className="text-sm text-[var(--brand)] font-medium">{formatNumber(apiKey.usageToday)}</span>
        <span className="text-xs text-[var(--text-muted)]"> / {formatNumber(apiKey.usageMonth)}</span>
        <p className="text-[10px] text-[var(--text-muted)]">today / month</p>
      </td>
      <td className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">{formatDate(apiKey.createdAt)}</td>
      <td className="px-4 py-3 text-right text-xs text-[var(--text-muted)]">{apiKey.lastUsedAt ? formatRelativeTime(apiKey.lastUsedAt) : 'Never'}</td>
      <td className="px-4 py-3 text-right">
        {apiKey.active ? (
          <button onClick={() => onAction(apiKey.id, 'revoke')} className="px-3 py-1.5 text-xs font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors">Revoke</button>
        ) : (
          <button onClick={() => onAction(apiKey.id, 'activate')} className="px-3 py-1.5 text-xs font-medium bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg transition-colors">Activate</button>
        )}
      </td>
    </tr>
  );
}

function CreateKeyModal({ onClose, onCreate }: { onClose: () => void; onCreate: (form: CreateKeyForm) => void }) {
  const [form, setForm] = useState<CreateKeyForm>({ name: '', email: '', tier: 'free', rateLimit: 60, description: '' });
  const rateLimits: Record<string, number> = { free: 60, pro: 300, enterprise: 1000 };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--surface-border)] w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--surface-border)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Plus className="w-5 h-5 text-[var(--brand)]" />
            Create API Key
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" placeholder="My API Key" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]" placeholder="user@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {(['free', 'pro', 'enterprise'] as const).map((tier) => (
                <button key={tier} type="button" onClick={() => setForm({ ...form, tier, rateLimit: rateLimits[tier] })} className={`px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all capitalize ${form.tier === tier ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]' : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--surface-hover)]'}`}>
                  {tier}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Rate Limit ({form.rateLimit} req/min)</label>
            <input type="range" min={10} max={2000} step={10} value={form.rateLimit} onChange={(e) => setForm({ ...form, rateLimit: parseInt(e.target.value, 10) })} className="w-full accent-[var(--brand)]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none" rows={2} placeholder="What will this key be used for?" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] font-medium rounded-xl transition-colors text-sm">Cancel</button>
            <button type="submit" className="flex-1 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-black font-medium rounded-xl transition-colors text-sm">Create Key</button>
          </div>
        </form>
      </div>
    </div>
  );
}
