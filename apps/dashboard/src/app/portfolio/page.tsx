'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Plus,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  PieChart,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  History,
  Minus,
  FileText,
  FileSpreadsheet,
  FileJson,
  CloudUpload,
  CloudDownload,
  BarChart3,
  X,
  Search,
} from 'lucide-react';
import { usePortfolio, Holding, Transaction } from '@/components/portfolio/PortfolioProvider';
import { AddHoldingModal } from '@/components/portfolio/AddHoldingModal';
import { DonutChart, getChartColor } from '@/components/charts/DonutChart';
import type { DonutSegment } from '@/components/charts/DonutChart';
import { PerformanceChart, generateMockPerformanceData } from '@/components/charts/PerformanceChart';
import type { TimeRange, PerformanceDataPoint } from '@/components/charts/PerformanceChart';
import Sparkline from '@/components/ui/Sparkline';
import { useToast } from '@/components/Toast';
import { getTopCoins, TokenPrice } from '@/lib/market-data';
import PageLayout from '@/components/PageLayout';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HoldingWithPrice extends Holding {
  currentPrice: number;
  change24h: number;
  change7d: number;
  value: number;
  profitLoss: number;
  profitLossPercent: number;
  allocation: number;
  image?: string;
  sparkline?: number[];
}

type SortField = 'name' | 'amount' | 'avgBuy' | 'price' | 'value' | 'profitLoss' | 'change24h' | 'allocation';
type SortDirection = 'asc' | 'desc';
type AllocationView = 'value' | 'sector' | 'chain';

// ─── Export Utilities ─────────────────────────────────────────────────────────

function holdingsToCSV(holdings: HoldingWithPrice[]): string {
  const header = 'Asset,Symbol,Amount,Avg Buy Price,Current Price,Value,P&L ($),P&L (%),Allocation (%)';
  const rows = holdings.map(h =>
    `${h.coinName},${h.coinSymbol.toUpperCase()},${h.amount},${h.averageBuyPrice.toFixed(2)},${h.currentPrice.toFixed(2)},${h.value.toFixed(2)},${h.profitLoss.toFixed(2)},${h.profitLossPercent.toFixed(2)},${h.allocation.toFixed(2)}`
  );
  return [header, ...rows].join('\n');
}

function transactionsToCSV(transactions: Transaction[]): string {
  const header = 'Date,Type,Coin,Symbol,Amount,Price,Total,Exchange,Notes';
  const rows = transactions.map(tx =>
    `${new Date(tx.date).toISOString()},${tx.type},${tx.coinName},${tx.coinSymbol.toUpperCase()},${tx.amount},${tx.pricePerCoin},${tx.totalValue},${tx.exchange || ''},${tx.notes || ''}`
  );
  return [header, ...rows].join('\n');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Portfolio Page ──────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { holdings, transactions, clearPortfolio, exportPortfolio, importPortfolio, isLoaded } =
    usePortfolio();
  const { addToast } = useToast();

  const [holdingsWithPrices, setHoldingsWithPrices] = useState<HoldingWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [importText, setImportText] = useState('');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [allocationView, setAllocationView] = useState<AllocationView>('value');
  const [perfTimeRange, setPerfTimeRange] = useState<TimeRange>('30d');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'buy' | 'sell'>('all');
  const [txSearch, setTxSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'holdings' | 'transactions'>('holdings');
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ─── Fetch prices ──────────────────────────────────────────────────────────

  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) {
      setHoldingsWithPrices([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const allCoins = await getTopCoins(250);
      const coinMap = new Map<string, TokenPrice>(allCoins.map(c => [c.id, c]));

      let totalValue = 0;
      const enriched: HoldingWithPrice[] = holdings.map(holding => {
        const coin = coinMap.get(holding.coinId);
        const currentPrice = coin?.current_price || 0;
        const change24h = coin?.price_change_percentage_24h || 0;
        const change7d = coin?.price_change_percentage_7d_in_currency || 0;
        const value = holding.amount * currentPrice;
        const profitLoss = value - holding.totalCost;
        const profitLossPercent = holding.totalCost > 0 ? (profitLoss / holding.totalCost) * 100 : 0;
        totalValue += value;

        return {
          ...holding,
          currentPrice,
          change24h,
          change7d,
          value,
          profitLoss,
          profitLossPercent,
          allocation: 0,
          image: coin?.image,
          sparkline: coin?.sparkline_in_7d?.price,
        };
      });

      enriched.forEach(h => {
        h.allocation = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
      });

      setHoldingsWithPrices(enriched);
    } catch (err) {
      console.error('Failed to fetch prices:', err);
      setError('Failed to load price data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [holdings]);

  useEffect(() => {
    if (isLoaded) fetchPrices();
  }, [isLoaded, fetchPrices]);

  useEffect(() => {
    if (!isLoaded) return;
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [isLoaded, fetchPrices]);

  // ─── Derived calculations ──────────────────────────────────────────────────

  const totalValue = useMemo(
    () => holdingsWithPrices.reduce((s, h) => s + h.value, 0),
    [holdingsWithPrices]
  );
  const totalCost = useMemo(
    () => holdingsWithPrices.reduce((s, h) => s + h.totalCost, 0),
    [holdingsWithPrices]
  );
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const change24hWeighted = useMemo(
    () =>
      holdingsWithPrices.length > 0
        ? holdingsWithPrices.reduce((s, h) => s + (h.change24h * h.allocation) / 100, 0)
        : 0,
    [holdingsWithPrices]
  );

  const change24hDollar = totalValue * (change24hWeighted / 100);

  const sortedByChange = useMemo(
    () => [...holdingsWithPrices].sort((a, b) => b.change24h - a.change24h),
    [holdingsWithPrices]
  );
  const bestPerformer = sortedByChange[0];
  const worstPerformer = sortedByChange[sortedByChange.length - 1];

  // ─── Sorted holdings ──────────────────────────────────────────────────────

  const sortedHoldings = useMemo(() => {
    return [...holdingsWithPrices].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.coinName.localeCompare(b.coinName); break;
        case 'amount': cmp = a.amount - b.amount; break;
        case 'avgBuy': cmp = a.averageBuyPrice - b.averageBuyPrice; break;
        case 'price': cmp = a.currentPrice - b.currentPrice; break;
        case 'value': cmp = a.value - b.value; break;
        case 'profitLoss': cmp = a.profitLoss - b.profitLoss; break;
        case 'change24h': cmp = a.change24h - b.change24h; break;
        case 'allocation': cmp = a.allocation - b.allocation; break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [holdingsWithPrices, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // ─── Donut data ────────────────────────────────────────────────────────────

  const donutSegments: DonutSegment[] = useMemo(() => {
    return holdingsWithPrices.map((h, i) => ({
      label: h.coinName,
      sublabel: h.coinSymbol.toUpperCase(),
      value: h.value,
      color: getChartColor(i),
    }));
  }, [holdingsWithPrices]);

  // ─── Performance data ─────────────────────────────────────────────────────

  const perfData: PerformanceDataPoint[] = useMemo(() => {
    if (totalValue <= 0) return [];
    return generateMockPerformanceData(totalValue, perfTimeRange);
  }, [totalValue, perfTimeRange]);

  // ─── Transaction history ──────────────────────────────────────────────────

  const filteredTransactions = useMemo(() => {
    let txs = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (txFilter === 'buy') txs = txs.filter(t => t.type === 'buy' || t.type === 'transfer_in');
    if (txFilter === 'sell') txs = txs.filter(t => t.type === 'sell' || t.type === 'transfer_out');
    if (txSearch) {
      const q = txSearch.toLowerCase();
      txs = txs.filter(t =>
        t.coinName.toLowerCase().includes(q) ||
        t.coinSymbol.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }
    return txs;
  }, [transactions, txFilter, txSearch]);

  // ─── Export handlers ──────────────────────────────────────────────────────

  const handleExportJSON = () => {
    const data = exportPortfolio();
    downloadFile(data, `portfolio-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    addToast({ type: 'success', title: 'Portfolio exported as JSON' });
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    const csv = holdingsToCSV(holdingsWithPrices);
    downloadFile(csv, `portfolio-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    addToast({ type: 'success', title: 'Holdings exported as CSV' });
    setShowExportMenu(false);
  };

  const handleExportTransactionsCSV = () => {
    const csv = transactionsToCSV(transactions);
    downloadFile(csv, `transactions-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    addToast({ type: 'success', title: 'Transactions exported as CSV' });
    setShowExportMenu(false);
  };

  const handleCloudSync = async () => {
    try {
      const data = exportPortfolio();
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data,
      });
      if (res.ok) {
        addToast({ type: 'success', title: 'Portfolio synced to cloud' });
      } else {
        addToast({ type: 'info', title: 'Cloud sync not available yet', message: 'Backend API coming soon' });
      }
    } catch {
      addToast({ type: 'info', title: 'Cloud sync not available yet', message: 'Backend API coming soon' });
    }
    setShowExportMenu(false);
  };

  const handleCloudImport = async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const data = await res.text();
        const result = importPortfolio(data);
        if (result.success) {
          addToast({ type: 'success', title: 'Portfolio imported from cloud' });
        } else {
          addToast({ type: 'error', title: 'Import failed', message: result.error });
        }
      } else {
        addToast({ type: 'info', title: 'Cloud import not available yet', message: 'Backend API coming soon' });
      }
    } catch {
      addToast({ type: 'info', title: 'Cloud import not available yet', message: 'Backend API coming soon' });
    }
    setShowExportMenu(false);
  };

  const handleImport = () => {
    const result = importPortfolio(importText);
    if (result.success) {
      addToast({ type: 'success', title: 'Portfolio imported successfully' });
      setShowImportModal(false);
      setImportText('');
    } else {
      addToast({ type: 'error', title: 'Import failed', message: result.error });
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      try {
        const result = importPortfolio(text);
        if (result.success) {
          addToast({ type: 'success', title: 'Portfolio imported' });
          setShowImportModal(false);
          return;
        }
      } catch {
        // Not valid JSON, ignore
      }
      addToast({ type: 'info', title: 'Paste portfolio JSON to import' });
    };
    reader.readAsText(file);
  };

  const handleClearPortfolio = () => {
    if (confirm('Are you sure you want to clear your entire portfolio? This cannot be undone.')) {
      clearPortfolio();
      addToast({ type: 'success', title: 'Portfolio cleared' });
    }
  };

  // ─── Sort header helper ────────────────────────────────────────────────────

  const SortHeader = ({ field, children, className: cn = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-wider ${cn}`}
    >
      {children}
      {sortField === field && (
        sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      )}
    </button>
  );

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (!isLoaded || isLoading) {
    return (
      <PageLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Wallet className="w-8 h-8 text-[var(--primary)]" />
            <h1 className="text-3xl font-bold">Portfolio</h1>
          </div>
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)]" />
              ))}
            </div>
            <div className="h-96 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)]" />
          </div>
        </div>
      </PageLayout>
    );
  }

  // ─── Empty state ───────────────────────────────────────────────────────────

  if (holdings.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <Wallet className="w-8 h-8 text-[var(--primary)]" />
            <h1 className="text-3xl font-bold">Portfolio</h1>
          </div>

          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-12 text-center">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-[var(--surface-hover)] flex items-center justify-center">
              <PieChart className="w-10 h-10 text-[var(--text-muted)]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Start tracking your portfolio</h2>
            <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
              Add your first transaction to begin tracking your crypto holdings, performance, and allocation.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-semibold transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Transaction
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface-hover)] hover:bg-[var(--surface-elevated)] text-[var(--text-secondary)] rounded-xl font-semibold transition-colors border border-[var(--surface-border)]"
              >
                <Upload className="w-5 h-5" />
                Import Portfolio
              </button>
            </div>

            <div className="mt-10 pt-8 border-t border-[var(--surface-border)]">
              <p className="text-xs text-[var(--text-muted)] mb-3">Quick start with popular coins</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['Bitcoin', 'Ethereum', 'Solana', 'XRP', 'Cardano'].map(name => (
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

        {showAddModal && <AddHoldingModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />}

        {showImportModal && (
          <ImportModal
            importText={importText}
            setImportText={setImportText}
            onImport={handleImport}
            onClose={() => setShowImportModal(false)}
            onFileImport={handleCSVImport}
          />
        )}
      </PageLayout>
    );
  }

  // ─── Main rendered page ────────────────────────────────────────────────────

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-[var(--primary)]" />
            <div>
              <h1 className="text-3xl font-bold">Portfolio</h1>
              <p className="text-[var(--text-secondary)] text-sm">
                {holdings.length} asset{holdings.length !== 1 ? 's' : ''} · {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPrices}
              className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] transition-colors"
                title="Export"
              >
                <Download className="w-5 h-5" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                  <button onClick={handleExportJSON} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] text-sm text-left text-[var(--text-primary)]">
                    <FileJson className="w-4 h-4 text-[var(--text-muted)]" /> Export JSON
                  </button>
                  <button onClick={handleExportCSV} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] text-sm text-left text-[var(--text-primary)]">
                    <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" /> Export Holdings CSV
                  </button>
                  <button onClick={handleExportTransactionsCSV} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] text-sm text-left text-[var(--text-primary)]">
                    <FileText className="w-4 h-4 text-[var(--text-muted)]" /> Export Transactions CSV
                  </button>
                  <div className="h-px bg-[var(--surface-border)] my-1" />
                  <button onClick={handleCloudSync} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] text-sm text-left text-[var(--text-primary)]">
                    <CloudUpload className="w-4 h-4 text-[var(--text-muted)]" /> Sync to Cloud
                  </button>
                  <button onClick={handleCloudImport} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--surface-hover)] text-sm text-left text-[var(--text-primary)]">
                    <CloudDownload className="w-4 h-4 text-[var(--text-muted)]" /> Import from Cloud
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Transaction</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--loss)]/10 border border-[var(--loss)]/30 rounded-xl flex items-center gap-3 text-[var(--loss)]">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1">{error}</p>
            <button onClick={fetchPrices} className="text-sm font-medium underline">Retry</button>
          </div>
        )}

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Value */}
          <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--surface-border)]">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Total Value</span>
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className={`flex items-center gap-1 mt-1 text-sm font-medium ${change24hWeighted >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
              {change24hWeighted >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{change24hWeighted >= 0 ? '+' : ''}{change24hWeighted.toFixed(2)}%</span>
              <span className="text-[var(--text-muted)]">·</span>
              <span>{change24hDollar >= 0 ? '+' : '-'}${Math.abs(change24hDollar).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span className="text-[var(--text-muted)] text-xs">(24h)</span>
            </div>
          </div>

          {/* Total P&L */}
          <div className={`rounded-2xl p-5 border ${totalPnL >= 0 ? 'bg-[var(--gain)]/5 border-[var(--gain)]/20' : 'bg-[var(--loss)]/5 border-[var(--loss)]/20'}`}>
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              {totalPnL >= 0 ? <TrendingUp className="w-4 h-4 text-[var(--gain)]" /> : <TrendingDown className="w-4 h-4 text-[var(--loss)]" />}
              <span className="text-xs font-semibold uppercase tracking-wider">All-time P&L</span>
            </div>
            <p className={`text-2xl lg:text-3xl font-bold tabular-nums ${totalPnL >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
              {totalPnL >= 0 ? '+$' : '-$'}{Math.abs(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`text-sm font-medium mt-1 ${totalPnL >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
              {totalPnL >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
            </p>
          </div>

          {/* Best Performer */}
          <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--surface-border)]">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <ArrowUpRight className="w-4 h-4 text-[var(--gain)]" />
              <span className="text-xs font-semibold uppercase tracking-wider">Best (24h)</span>
            </div>
            {bestPerformer ? (
              <>
                <p className="text-lg font-bold text-[var(--text-primary)] truncate">{bestPerformer.coinName}</p>
                <p className="text-sm font-medium text-[var(--gain)]">+{Math.abs(bestPerformer.change24h).toFixed(2)}%</p>
              </>
            ) : (
              <p className="text-[var(--text-muted)]">—</p>
            )}
          </div>

          {/* Worst Performer */}
          <div className="bg-[var(--surface)] rounded-2xl p-5 border border-[var(--surface-border)]">
            <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
              <ArrowDownRight className="w-4 h-4 text-[var(--loss)]" />
              <span className="text-xs font-semibold uppercase tracking-wider">Worst (24h)</span>
            </div>
            {worstPerformer ? (
              <>
                <p className="text-lg font-bold text-[var(--text-primary)] truncate">{worstPerformer.coinName}</p>
                <p className="text-sm font-medium text-[var(--loss)]">{worstPerformer.change24h.toFixed(2)}%</p>
              </>
            ) : (
              <p className="text-[var(--text-muted)]">—</p>
            )}
          </div>
        </div>

        {/* ── Charts Row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {/* Performance Chart */}
          <div className="lg:col-span-3 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-5">
            <h2 className="text-lg font-semibold mb-4">Performance</h2>
            <PerformanceChart
              data={perfData}
              timeRange={perfTimeRange}
              onTimeRangeChange={setPerfTimeRange}
              height={280}
              isCurrency
            />
          </div>

          {/* Allocation Donut */}
          <div className="lg:col-span-2 bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Allocation</h2>
              <div className="flex items-center gap-1 bg-[var(--surface-hover)] rounded-lg p-0.5">
                {(['value', 'sector', 'chain'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setAllocationView(v)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${allocationView === v ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {v === 'value' ? 'Value' : v === 'sector' ? 'Sector' : 'Chain'}
                  </button>
                ))}
              </div>
            </div>
            <DonutChart
              segments={donutSegments}
              size={180}
              strokeWidth={28}
              centerLabel="Total"
              centerValue={`$${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}K` : totalValue.toFixed(0)}`}
              showLegend
            />
          </div>
        </div>

        {/* ── Tab Switcher ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-4 border-b border-[var(--surface-border)]">
          <button
            onClick={() => setActiveTab('holdings')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'holdings' ? 'text-[var(--primary)] border-[var(--primary)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]'}`}
          >
            Holdings
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'transactions' ? 'text-[var(--primary)] border-[var(--primary)]' : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)]'}`}
          >
            Transactions
            <span className="ml-1.5 text-xs bg-[var(--surface-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">
              {transactions.length}
            </span>
          </button>
        </div>

        {/* ── Holdings Table ──────────────────────────────────────────────── */}
        {activeTab === 'holdings' && (
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--surface-border)]">
                    <th className="px-5 py-3 text-left"><SortHeader field="name">Asset</SortHeader></th>
                    <th className="px-3 py-3 text-right"><SortHeader field="amount" className="ml-auto">Amount</SortHeader></th>
                    <th className="px-3 py-3 text-right hidden md:table-cell"><SortHeader field="avgBuy" className="ml-auto">Avg Buy</SortHeader></th>
                    <th className="px-3 py-3 text-right"><SortHeader field="price" className="ml-auto">Price</SortHeader></th>
                    <th className="px-3 py-3 text-right hidden sm:table-cell">
                      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">7d</span>
                    </th>
                    <th className="px-3 py-3 text-right"><SortHeader field="value" className="ml-auto">Value</SortHeader></th>
                    <th className="px-3 py-3 text-right"><SortHeader field="profitLoss" className="ml-auto">P&L</SortHeader></th>
                    <th className="px-3 py-3 text-right hidden lg:table-cell"><SortHeader field="allocation" className="ml-auto">Alloc</SortHeader></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map(h => (
                    <React.Fragment key={h.coinId}>
                      <tr
                        className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                        onClick={() => setExpandedRow(expandedRow === h.coinId ? null : h.coinId)}
                      >
                        <td className="px-5 py-3">
                          <Link href={`/coin/${h.coinId}`} className="flex items-center gap-3 group" onClick={e => e.stopPropagation()}>
                            {h.image ? (
                              <img src={h.image} alt={h.coinName} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                                {h.coinSymbol.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] text-sm transition-colors">
                                {h.coinName}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">{h.coinSymbol.toUpperCase()}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-[var(--text-primary)] tabular-nums">
                          {h.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-[var(--text-secondary)] tabular-nums hidden md:table-cell">
                          ${h.averageBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: h.averageBuyPrice < 1 ? 6 : 2 })}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-[var(--text-primary)] tabular-nums">
                          ${h.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: h.currentPrice < 1 ? 6 : 2 })}
                        </td>
                        <td className="px-3 py-3 text-right hidden sm:table-cell">
                          {h.sparkline && h.sparkline.length > 1 ? (
                            <Sparkline data={h.sparkline} width={80} height={28} isPositive={h.change7d >= 0} />
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                          ${h.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className={`text-sm font-medium tabular-nums ${h.profitLoss >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                            <span>{h.profitLoss >= 0 ? '+' : '-'}${Math.abs(h.profitLoss).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            <span className="block text-xs">{h.profitLoss >= 0 ? '+' : ''}{h.profitLossPercent.toFixed(2)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 h-1.5 bg-[var(--surface-hover)] rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${Math.min(h.allocation, 100)}%` }} />
                            </div>
                            <span className="text-xs text-[var(--text-muted)] tabular-nums w-10 text-right">{h.allocation.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded transaction sub-row */}
                      {expandedRow === h.coinId && (
                        <tr>
                          <td colSpan={8} className="px-5 py-4 bg-[var(--surface-hover)]/30">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                Transaction History — {h.coinName}
                              </h4>
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowAddModal(true); }}
                                className="text-xs text-[var(--primary)] font-medium hover:underline flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            </div>
                            {h.transactions.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {[...h.transactions].reverse().map(tx => (
                                  <div key={tx.id} className="flex items-center justify-between p-3 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)]">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${tx.type === 'buy' || tx.type === 'transfer_in' ? 'bg-[var(--gain)]/20 text-[var(--gain)]' : 'bg-[var(--loss)]/20 text-[var(--loss)]'}`}>
                                        {tx.type === 'buy' || tx.type === 'transfer_in' ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{tx.type.replace('_', ' ')}</p>
                                        <p className="text-xs text-[var(--text-muted)]">
                                          {new Date(tx.date).toLocaleDateString()}
                                          {tx.exchange && ` · ${tx.exchange}`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-medium text-[var(--text-primary)] tabular-nums">{tx.amount.toLocaleString()} {h.coinSymbol.toUpperCase()}</p>
                                      <p className="text-xs text-[var(--text-muted)] tabular-nums">@ ${tx.pricePerCoin.toLocaleString()} = ${tx.totalValue.toLocaleString()}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-[var(--text-muted)]">No transactions recorded</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Transaction History Tab ─────────────────────────────────────── */}
        {activeTab === 'transactions' && (
          <div className="mb-8">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-1 bg-[var(--surface)] border border-[var(--surface-border)] rounded-lg p-0.5">
                {(['all', 'buy', 'sell'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTxFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${txFilter === f ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {f === 'all' ? 'All' : f === 'buy' ? 'Buys' : 'Sells'}
                  </button>
                ))}
              </div>
            </div>

            {/* Transaction list */}
            {filteredTransactions.length > 0 ? (
              <div className="space-y-2">
                {filteredTransactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-4 bg-[var(--surface)] rounded-xl border border-[var(--surface-border)] hover:bg-[var(--surface-hover)] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tx.type === 'buy' || tx.type === 'transfer_in' ? 'bg-[var(--gain)]/20 text-[var(--gain)]' : 'bg-[var(--loss)]/20 text-[var(--loss)]'}`}>
                        {tx.type === 'buy' || tx.type === 'transfer_in' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)] text-sm capitalize">{tx.type.replace('_', ' ')} {tx.coinSymbol.toUpperCase()}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {tx.exchange && ` · ${tx.exchange}`}
                          {tx.notes && ` · ${tx.notes}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold tabular-nums ${tx.type === 'buy' || tx.type === 'transfer_in' ? 'text-[var(--gain)]' : 'text-[var(--loss)]'}`}>
                        {tx.type === 'buy' || tx.type === 'transfer_in' ? '+' : '-'}{tx.amount.toLocaleString()} {tx.coinSymbol.toUpperCase()}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] tabular-nums">
                        ${tx.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[var(--surface)] rounded-xl border border-[var(--surface-border)]">
                <History className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                <p className="text-[var(--text-muted)]">
                  {txSearch || txFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <p>Data refreshes every minute · Prices from CoinGecko</p>
          <button onClick={handleClearPortfolio} className="flex items-center gap-1 text-[var(--loss)] hover:underline">
            <Trash2 className="w-3.5 h-3.5" /> Clear portfolio
          </button>
        </div>

        {/* ── Modals ──────────────────────────────────────────────────────── */}
        {showAddModal && <AddHoldingModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />}

        {showImportModal && (
          <ImportModal
            importText={importText}
            setImportText={setImportText}
            onImport={handleImport}
            onClose={() => setShowImportModal(false)}
            onFileImport={handleCSVImport}
          />
        )}
      </div>
    </PageLayout>
  );
}

// ─── Import Modal ──────────────────────────────────────────────────────────

interface ImportModalProps {
  importText: string;
  setImportText: (text: string) => void;
  onImport: () => void;
  onClose: () => void;
  onFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function ImportModal({ importText, setImportText, onImport, onClose, onFileImport }: ImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Import Portfolio</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder="Paste your portfolio JSON here..."
          className="w-full h-40 p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] resize-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent text-sm font-mono"
        />
        <div className="flex items-center justify-between gap-3 mt-4">
          <div>
            <input ref={fileRef} type="file" accept=".json,.csv" className="hidden" onChange={onFileImport} />
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              <Upload className="w-4 h-4" /> Choose file
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Cancel</button>
            <button
              onClick={onImport}
              disabled={!importText.trim()}
              className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 text-white rounded-lg font-medium"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
