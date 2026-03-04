'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Bell,
  BellOff,
  BellRing,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  Percent,
  Check,
  AlertCircle,
  Clock,
  ChevronDown,
  Volume2,
  Filter,
} from 'lucide-react';
import { useAlerts, PriceAlert } from '@/components/alerts/AlertsProvider';
import { useToast } from '@/components/Toast';
import { getTopCoins, TokenPrice } from '@/lib/market-data';
import PageLayout from '@/components/PageLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertTab = 'active' | 'triggered' | 'all';
type AlertCondition = 'above' | 'below' | 'percent_up' | 'percent_down';

interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  image?: string;
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function getConditionIcon(condition: PriceAlert['condition']) {
  switch (condition) {
    case 'above':
    case 'percent_up':
      return TrendingUp;
    case 'below':
    case 'percent_down':
      return TrendingDown;
    default:
      return Bell;
  }
}

function getConditionColor(condition: PriceAlert['condition'], triggered: boolean) {
  if (triggered) return 'bg-[var(--gain)]/20 text-[var(--gain)]';
  switch (condition) {
    case 'above':
    case 'percent_up':
      return 'bg-[var(--gain)]/20 text-[var(--gain)]';
    case 'below':
    case 'percent_down':
      return 'bg-[var(--loss)]/20 text-[var(--loss)]';
    default:
      return 'bg-[var(--surface-hover)] text-[var(--text-muted)]';
  }
}

function getAlertDescription(alert: PriceAlert): string {
  const isPercent = alert.condition === 'percent_up' || alert.condition === 'percent_down';
  if (isPercent) {
    return alert.condition === 'percent_up'
      ? `Price increases by ${alert.targetPercent}%`
      : `Price decreases by ${alert.targetPercent}%`;
  }
  const priceStr = `$${alert.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
  return alert.condition === 'above'
    ? `Price goes above ${priceStr}`
    : `Price goes below ${priceStr}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ─── Main Alerts Page ─────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { alerts, addAlert, removeAlert, toggleAlert, clearTriggeredAlerts, clearAllAlerts, isLoaded } = useAlerts();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<AlertTab>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Check notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        addToast({ type: 'success', title: 'Notifications enabled' });
      }
    }
  };

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    let filtered = [...alerts];

    if (activeTab === 'active') filtered = filtered.filter(a => !a.triggered);
    if (activeTab === 'triggered') filtered = filtered.filter(a => a.triggered);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        a => a.coinName.toLowerCase().includes(q) || a.coinSymbol.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [alerts, activeTab, searchQuery]);

  const activeCount = alerts.filter(a => !a.triggered).length;
  const triggeredCount = alerts.filter(a => a.triggered).length;

  const handleRemoveAlert = (id: string, symbol: string) => {
    removeAlert(id);
    addToast({ type: 'info', title: 'Alert removed', message: `${symbol.toUpperCase()} alert deleted` });
  };

  const handleReactivate = (id: string) => {
    toggleAlert(id);
    addToast({ type: 'success', title: 'Alert reactivated' });
  };

  const handleClearTriggered = () => {
    if (confirm('Clear all triggered alerts?')) {
      clearTriggeredAlerts();
      addToast({ type: 'success', title: 'Triggered alerts cleared' });
    }
  };

  const handleClearAll = () => {
    if (confirm('Delete all alerts? This cannot be undone.')) {
      clearAllAlerts();
      addToast({ type: 'success', title: 'All alerts cleared' });
    }
  };

  // ─── Loading state ─────────────────────────────────────────────────────

  if (!isLoaded) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Bell className="w-8 h-8 text-[var(--primary)]" />
            <h1 className="text-3xl font-bold">Price Alerts</h1>
          </div>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)]" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────

  if (alerts.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Bell className="w-8 h-8 text-[var(--primary)]" />
            <h1 className="text-3xl font-bold">Price Alerts</h1>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-12 text-center">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-[var(--surface-hover)] flex items-center justify-center">
              <BellRing className="w-10 h-10 text-[var(--text-muted)]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No price alerts</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
              Create alerts to get notified when your favorite coins hit target prices or change by a percentage.
            </p>

            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-semibold transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Your First Alert
            </button>

            {notificationPermission !== 'granted' && (
              <div className="mt-8 p-4 bg-[var(--surface-hover)] rounded-xl max-w-sm mx-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Volume2 className="w-4 h-4 text-[var(--text-muted)]" />
                  <p className="text-sm font-medium text-[var(--text-secondary)]">Browser notifications</p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Enable browser notifications to get alerted even when not on this page.
                </p>
                <button
                  onClick={requestNotificationPermission}
                  className="text-xs font-medium text-[var(--primary)] hover:underline"
                >
                  Enable notifications
                </button>
              </div>
            )}

            <div className="mt-10 pt-8 border-t border-[var(--surface-border)]">
              <p className="text-xs text-[var(--text-muted)] mb-3">Or set alerts from any coin page</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Bitcoin', 'Ethereum', 'Solana', 'XRP', 'Dogecoin'].map(name => (
                  <Link
                    key={name}
                    href={`/coin/${name.toLowerCase()}`}
                    className="px-4 py-2 bg-[var(--surface-hover)] hover:bg-[var(--primary)]/20 rounded-full text-sm font-medium text-[var(--text-secondary)] transition-colors"
                  >
                    {name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showCreateModal && (
          <CreateAlertModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              addToast({ type: 'success', title: 'Alert created' });
            }}
          />
        )}
      </PageLayout>
    );
  }

  // ─── Main rendered page ────────────────────────────────────────────────

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8 text-[var(--primary)]" />
            <div>
              <h1 className="text-3xl font-bold">Price Alerts</h1>
              <p className="text-[var(--text-secondary)] text-sm">
                {activeCount} active · {triggeredCount} triggered
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' && (
              <button
                onClick={requestNotificationPermission}
                className="flex items-center gap-2 px-3 py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--surface-border)] rounded-lg text-sm text-[var(--text-secondary)] transition-colors"
                title="Enable browser notifications"
              >
                <BellOff className="w-4 h-4" />
                <span className="hidden sm:inline">Enable Notifications</span>
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Alert</span>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--surface-border)]">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <Bell className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{activeCount}</p>
          </div>
          <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--surface-border)]">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <Check className="w-4 h-4 text-[var(--gain)]" />
              <span className="text-xs font-semibold uppercase tracking-wider">Triggered</span>
            </div>
            <p className="text-2xl font-bold text-[var(--gain)]">{triggeredCount}</p>
          </div>
          <div className="bg-[var(--surface)] rounded-2xl p-4 border border-[var(--surface-border)]">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Total</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{alerts.length}</p>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg p-0.5">
            {([
              { key: 'active' as const, label: 'Active', count: activeCount },
              { key: 'triggered' as const, label: 'Triggered', count: triggeredCount },
              { key: 'all' as const, label: 'All', count: alerts.length },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
                <span className="ml-1 opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Alerts List */}
        {filteredAlerts.length > 0 ? (
          <div className="space-y-2 mb-6">
            {filteredAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onRemove={() => handleRemoveAlert(alert.id, alert.coinSymbol)}
                onReactivate={() => handleReactivate(alert.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] mb-6">
            <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)]">
              {searchQuery ? `No alerts matching "${searchQuery}"` : `No ${activeTab} alerts`}
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <p>Alerts are checked every 30 seconds · Prices from CoinGecko</p>
          <div className="flex items-center gap-4">
            {triggeredCount > 0 && (
              <button onClick={handleClearTriggered} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:underline">
                Clear triggered
              </button>
            )}
            {alerts.length > 0 && (
              <button onClick={handleClearAll} className="text-[var(--loss)] hover:underline">
                Clear all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create Alert Modal */}
      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            addToast({ type: 'success', title: 'Alert created' });
          }}
        />
      )}
    </PageLayout>
  );
}

// ─── Alert Card Component ─────────────────────────────────────────────────────

interface AlertCardProps {
  alert: PriceAlert;
  onRemove: () => void;
  onReactivate: () => void;
}

function AlertCard({ alert, onRemove, onReactivate }: AlertCardProps) {
  const Icon = getConditionIcon(alert.condition);
  const colorClass = getConditionColor(alert.condition, alert.triggered);

  return (
    <div
      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors hover:bg-[var(--surface-hover)] ${
        alert.triggered
          ? 'bg-[var(--gain)]/5 border-[var(--gain)]/20'
          : 'bg-[var(--surface)] border-[var(--surface-border)]'
      }`}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        {alert.triggered ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link
            href={`/coin/${alert.coinId}`}
            className="font-semibold text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors"
          >
            {alert.coinName}
          </Link>
          <span className="text-xs text-[var(--text-muted)]">{alert.coinSymbol.toUpperCase()}</span>
          {alert.repeat && (
            <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-medium">
              Repeat
            </span>
          )}
          {alert.notifyBrowser && (
            <Bell className="w-3 h-3 text-[var(--text-muted)]" title="Browser notification enabled" />
          )}
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{getAlertDescription(alert)}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
          <span>Created price: ${alert.createdPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
          <span>·</span>
          <span>{formatRelativeTime(alert.createdAt)}</span>
          {alert.triggered && alert.triggeredAt && (
            <>
              <span>·</span>
              <span className="text-[var(--gain)]">Triggered {formatRelativeTime(alert.triggeredAt)}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {alert.triggered && (
          <button
            onClick={onReactivate}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
            title="Reactivate alert"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onRemove}
          className="p-2 rounded-lg hover:bg-[var(--loss)]/20 text-[var(--text-muted)] hover:text-[var(--loss)] transition-colors"
          title="Remove alert"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Create Alert Modal ───────────────────────────────────────────────────────

interface CreateAlertModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateAlertModal({ onClose, onCreated }: CreateAlertModalProps) {
  const { addAlert } = useAlerts();

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [allCoins, setAllCoins] = useState<CoinSearchResult[]>([]);
  const [coinSearch, setCoinSearch] = useState('');
  const [isLoadingCoins, setIsLoadingCoins] = useState(true);
  const [selectedCoin, setSelectedCoin] = useState<CoinSearchResult | null>(null);

  // Alert configuration
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [targetPercent, setTargetPercent] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPercentCondition = condition === 'percent_up' || condition === 'percent_down';

  // Load coins
  useEffect(() => {
    const loadCoins = async () => {
      try {
        const coins = await getTopCoins(250);
        setAllCoins(coins.map(c => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          current_price: c.current_price,
          image: c.image,
        })));
      } catch {
        // Silently fail, user can retry
      } finally {
        setIsLoadingCoins(false);
      }
    };
    loadCoins();
  }, []);

  const filteredCoins = useMemo(() => {
    if (!coinSearch) return allCoins.slice(0, 20);
    const q = coinSearch.toLowerCase();
    return allCoins
      .filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allCoins, coinSearch]);

  const handleSelectCoin = (coin: CoinSearchResult) => {
    setSelectedCoin(coin);
    setStep('configure');
    setTargetPrice((coin.current_price * 1.05).toFixed(2));
    setTargetPercent('10');
  };

  // Update default target when condition changes
  useEffect(() => {
    if (!selectedCoin) return;
    if (condition === 'above') {
      setTargetPrice((selectedCoin.current_price * 1.05).toFixed(2));
    } else if (condition === 'below') {
      setTargetPrice((selectedCoin.current_price * 0.95).toFixed(2));
    }
  }, [condition, selectedCoin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoin) return;
    setError(null);

    if (isPercentCondition) {
      const pct = parseFloat(targetPercent);
      if (isNaN(pct) || pct <= 0 || pct > 1000) {
        setError('Enter a valid percentage (1–1000%)');
        return;
      }
    } else {
      const price = parseFloat(targetPrice);
      if (isNaN(price) || price <= 0) {
        setError('Enter a valid target price');
        return;
      }
    }

    const result = addAlert({
      coinId: selectedCoin.id,
      coinName: selectedCoin.name,
      coinSymbol: selectedCoin.symbol,
      condition,
      targetPrice: isPercentCondition ? selectedCoin.current_price : parseFloat(targetPrice),
      targetPercent: isPercentCondition ? parseFloat(targetPercent) : undefined,
      createdPrice: selectedCoin.current_price,
      repeat,
      notifyBrowser,
    });

    if (result.success) {
      onCreated();
    } else {
      setError(result.error || 'Failed to create alert');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--surface-border)] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[var(--primary)]/10">
              <Bell className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">
                {step === 'select' ? 'Select Coin' : 'Configure Alert'}
              </h2>
              {selectedCoin && step === 'configure' && (
                <p className="text-xs text-[var(--text-muted)]">
                  {selectedCoin.name} ({selectedCoin.symbol.toUpperCase()})
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Coin Selection */}
        {step === 'select' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--surface-border)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search coins..."
                  value={coinSearch}
                  onChange={e => setCoinSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-primary)] border border-[var(--surface-border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingCoins ? (
                <div className="animate-pulse space-y-2 p-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-14 bg-[var(--surface-hover)] rounded-xl" />
                  ))}
                </div>
              ) : filteredCoins.length > 0 ? (
                filteredCoins.map(coin => (
                  <button
                    key={coin.id}
                    onClick={() => handleSelectCoin(coin)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-hover)] transition-colors text-left"
                  >
                    {coin.image ? (
                      <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                        {coin.symbol.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-[var(--text-primary)] text-sm">{coin.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{coin.symbol.toUpperCase()}</p>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] tabular-nums">
                      ${coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: coin.current_price < 1 ? 6 : 2 })}
                    </p>
                  </button>
                ))
              ) : (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                  No coins found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Configure Alert */}
        {step === 'configure' && selectedCoin && (
          <div className="flex-1 overflow-y-auto">
            {/* Current Price */}
            <div className="px-6 py-4 bg-[var(--surface-hover)]/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Current Price</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    ${selectedCoin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </p>
                </div>
                <button
                  onClick={() => { setStep('select'); setSelectedCoin(null); }}
                  className="text-xs text-[var(--primary)] hover:underline"
                >
                  Change coin
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Condition */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Alert me when price
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'above' as const, label: 'Goes Above', icon: TrendingUp, gain: true },
                    { key: 'below' as const, label: 'Goes Below', icon: TrendingDown, gain: false },
                    { key: 'percent_up' as const, label: 'Up By %', icon: Percent, gain: true },
                    { key: 'percent_down' as const, label: 'Down By %', icon: Percent, gain: false },
                  ]).map(opt => {
                    const Icon = opt.icon;
                    const active = condition === opt.key;
                    const borderColor = active
                      ? opt.gain ? 'border-[var(--gain)] bg-[var(--gain)]/10 text-[var(--gain)]' : 'border-[var(--loss)] bg-[var(--loss)]/10 text-[var(--loss)]'
                      : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]';
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCondition(opt.key)}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${borderColor}`}
                      >
                        <Icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  {isPercentCondition ? 'Percentage' : 'Target Price'}
                </label>
                {isPercentCondition ? (
                  <div className="relative">
                    <input
                      type="number"
                      value={targetPercent}
                      onChange={e => setTargetPercent(e.target.value)}
                      placeholder="e.g. 10"
                      step="0.1"
                      min="0.1"
                      max="1000"
                      className="w-full px-4 py-3 pr-10 rounded-xl border border-[var(--surface-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">%</span>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                    <input
                      type="number"
                      value={targetPrice}
                      onChange={e => setTargetPrice(e.target.value)}
                      placeholder="0.00"
                      step="any"
                      min="0"
                      className="w-full px-4 py-3 pl-8 rounded-xl border border-[var(--surface-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    />
                  </div>
                )}
                {!isPercentCondition && targetPrice && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {(((parseFloat(targetPrice) - selectedCoin.current_price) / selectedCoin.current_price) * 100).toFixed(2)}%{' '}
                    {parseFloat(targetPrice) >= selectedCoin.current_price ? 'above' : 'below'} current price
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={e => setRepeat(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--surface-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Repeat (notify every time)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyBrowser}
                    onChange={e => setNotifyBrowser(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--surface-border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">Browser notification</span>
                </label>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg bg-[var(--loss)]/10 border border-[var(--loss)]/30 flex items-start gap-2 text-[var(--loss)]">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Bell className="w-5 h-5" />
                Create Alert
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
