'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Activity,
  Radio,
  Zap,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Maximize2,
} from 'lucide-react';
import { StreamingChart } from '@/components/charts';
import { tokens } from '@/lib/colors';

interface PriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  timestamp: number;
  volume?: number;
}

const DEFAULT_SYMBOLS = ['bitcoin', 'ethereum', 'solana', 'cardano', 'avalanche-2', 'polkadot'];

const SYMBOL_DISPLAY: Record<string, { label: string; ticker: string }> = {
  bitcoin: { label: 'Bitcoin', ticker: 'BTC' },
  ethereum: { label: 'Ethereum', ticker: 'ETH' },
  solana: { label: 'Solana', ticker: 'SOL' },
  cardano: { label: 'Cardano', ticker: 'ADA' },
  'avalanche-2': { label: 'Avalanche', ticker: 'AVAX' },
  polkadot: { label: 'Polkadot', ticker: 'DOT' },
  ripple: { label: 'XRP', ticker: 'XRP' },
  chainlink: { label: 'Chainlink', ticker: 'LINK' },
  dogecoin: { label: 'Dogecoin', ticker: 'DOGE' },
};

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function PriceTicker({
  symbol,
  latest,
  isSelected,
  onClick,
}: {
  symbol: string;
  latest: PriceUpdate | null;
  isSelected: boolean;
  onClick: () => void;
}) {
  const display = SYMBOL_DISPLAY[symbol] ?? { label: symbol, ticker: symbol.toUpperCase() };
  const isUp = latest && latest.change24h >= 0;
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    if (latest && prevPrice.current !== null && latest.price !== prevPrice.current) {
      setFlash(latest.price > prevPrice.current ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 400);
      prevPrice.current = latest.price;
      return () => clearTimeout(t);
    }
    if (latest) prevPrice.current = latest.price;
  }, [latest]);

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col gap-1 p-3 rounded-xl border transition-all duration-200 cursor-pointer text-left
        ${isSelected
          ? 'bg-brand-primary/10 border-brand-primary/40 shadow-lg shadow-brand-primary/5'
          : 'bg-surface border-surface-border hover:border-text-tertiary/40 hover:bg-surface-elevated'
        }
        ${flash === 'up' ? 'ring-1 ring-gain/40' : ''}
        ${flash === 'down' ? 'ring-1 ring-loss/40' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary">{display.ticker}</span>
        {latest && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              isUp ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
            }`}
          >
            {isUp ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {Math.abs(latest.change24h).toFixed(2)}%
          </span>
        )}
      </div>
      <span className="text-sm font-mono font-bold text-text-primary tabular-nums">
        {latest ? formatPrice(latest.price) : '—'}
      </span>
      <span className="text-[10px] text-text-tertiary">{display.label}</span>
    </button>
  );
}

function TradeLog({ trades }: { trades: PriceUpdate[] }) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
        <Clock className="w-4 h-4 text-text-tertiary" />
        <h3 className="text-sm font-semibold text-text-primary">Recent Updates</h3>
        <span className="ml-auto text-xs text-text-tertiary">{trades.length} events</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {trades.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-tertiary">Waiting for data...</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-tertiary border-b border-surface-border">
                <th className="text-left px-4 py-2 font-medium">Time</th>
                <th className="text-left px-3 py-2 font-medium">Symbol</th>
                <th className="text-right px-4 py-2 font-medium">Price</th>
                <th className="text-right px-4 py-2 font-medium">24h</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const display = SYMBOL_DISPLAY[t.symbol] ?? { ticker: t.symbol };
                const isUp = t.change24h >= 0;
                return (
                  <tr
                    key={`${t.symbol}-${t.timestamp}-${i}`}
                    className="border-b border-surface-border/50 hover:bg-surface-elevated/50 transition-colors"
                  >
                    <td className="px-4 py-1.5 text-text-tertiary font-mono">{formatTime(t.timestamp)}</td>
                    <td className="px-3 py-1.5 text-text-primary font-semibold">{display.ticker}</td>
                    <td className="px-4 py-1.5 text-right text-text-primary font-mono">{formatPrice(t.price)}</td>
                    <td className={`px-4 py-1.5 text-right font-medium ${isUp ? 'text-gain' : 'text-loss'}`}>
                      {isUp ? '+' : ''}{t.change24h.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function LivePage() {
  const [selectedSymbol, setSelectedSymbol] = useState('bitcoin');
  const [latestPrices, setLatestPrices] = useState<Record<string, PriceUpdate>>({});
  const [tradeLog, setTradeLog] = useState<PriceUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:8080/ws/prices`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          let updates: PriceUpdate[] = [];

          if (Array.isArray(data)) {
            updates = data.map((d: Record<string, unknown>) => ({
              symbol: (d.id ?? d.symbol ?? 'unknown') as string,
              price: Number(d.current_price ?? d.price ?? 0),
              change24h: Number(d.price_change_percentage_24h ?? d.change24h ?? 0),
              timestamp: Date.now(),
              volume: d.total_volume ? Number(d.total_volume) : undefined,
            }));
          } else if (data.type === 'price_update' && data.data) {
            const d = data.data;
            updates = [
              {
                symbol: d.id ?? d.symbol ?? 'unknown',
                price: Number(d.current_price ?? d.price ?? 0),
                change24h: Number(d.price_change_percentage_24h ?? d.change24h ?? 0),
                timestamp: Date.now(),
                volume: d.total_volume ? Number(d.total_volume) : undefined,
              },
            ];
          }

          if (updates.length > 0) {
            setLatestPrices((prev) => {
              const next = { ...prev };
              for (const u of updates) next[u.symbol] = u;
              return next;
            });
            setTradeLog((prev) => [...updates, ...prev].slice(0, 200));
          }
        } catch {
          // ignore invalid messages
        }
      };
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  // REST fallback: poll every 15s if WS isn't connected
  useEffect(() => {
    if (isConnected) return;
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/market/prices?ids=' + DEFAULT_SYMBOLS.join(','));
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          const newPrices: Record<string, PriceUpdate> = {};
          for (const coin of data) {
            const update: PriceUpdate = {
              symbol: coin.id ?? coin.symbol,
              price: Number(coin.current_price ?? coin.price ?? 0),
              change24h: Number(coin.price_change_percentage_24h ?? coin.change24h ?? 0),
              timestamp: Date.now(),
              volume: coin.total_volume ? Number(coin.total_volume) : undefined,
            };
            newPrices[update.symbol] = update;
          }
          setLatestPrices((prev) => ({ ...prev, ...newPrices }));
          setTradeLog((prev) => [...Object.values(newPrices), ...prev].slice(0, 200));
        }
      } catch {
        // silent fail
      }
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 15000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const selectedDisplay = SYMBOL_DISPLAY[selectedSymbol] ?? { label: selectedSymbol, ticker: selectedSymbol };
  const selectedLatest = latestPrices[selectedSymbol] ?? null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-primary/10 rounded-xl">
              <Radio className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Live Market Feed</h1>
              <p className="text-sm text-text-secondary">Real-time streaming prices via WebSocket</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                isConnected
                  ? 'bg-gain/10 text-gain border border-gain/20'
                  : 'bg-loss/10 text-loss border border-loss/20'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Connected</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gain animate-pulse" />
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Reconnecting...</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Price Ticker Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {DEFAULT_SYMBOLS.map((sym) => (
            <PriceTicker
              key={sym}
              symbol={sym}
              latest={latestPrices[sym] ?? null}
              isSelected={sym === selectedSymbol}
              onClick={() => setSelectedSymbol(sym)}
            />
          ))}
        </div>

        {/* Main Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface rounded-2xl border border-surface-border overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-primary" />
                <div>
                  <h2 className="text-lg font-bold text-text-primary">{selectedDisplay.label}</h2>
                  <span className="text-xs text-text-tertiary">{selectedDisplay.ticker}/USD</span>
                </div>
                {selectedLatest && (
                  <div className="ml-3 flex items-center gap-2">
                    <span className="text-lg font-bold font-mono text-text-primary">
                      {formatPrice(selectedLatest.price)}
                    </span>
                    <span
                      className={`flex items-center gap-0.5 text-sm font-medium ${
                        selectedLatest.change24h >= 0 ? 'text-gain' : 'text-loss'
                      }`}
                    >
                      {selectedLatest.change24h >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      {selectedLatest.change24h >= 0 ? '+' : ''}
                      {selectedLatest.change24h.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-warning" />
                <span className="text-xs text-text-tertiary">Real-time</span>
              </div>
            </div>
            <div className="p-4">
              <StreamingChart
                symbol={selectedSymbol}
                height={400}
                type="area"
                maxPoints={300}
                showStats
              />
            </div>
          </div>

          {/* Trade Log */}
          <div className="lg:col-span-1">
            <TradeLog trades={tradeLog} />
          </div>
        </div>

        {/* Multi-chart grid */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-text-tertiary" />
            <h2 className="text-lg font-bold text-text-primary">All Streams</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {DEFAULT_SYMBOLS.filter((s) => s !== selectedSymbol).map((sym) => {
              const display = SYMBOL_DISPLAY[sym] ?? { label: sym, ticker: sym };
              const latest = latestPrices[sym] ?? null;
              return (
                <div
                  key={sym}
                  className="bg-surface rounded-xl border border-surface-border overflow-hidden hover:border-text-tertiary/40 transition-colors cursor-pointer"
                  onClick={() => setSelectedSymbol(sym)}
                >
                  <div className="px-4 py-3 flex items-center justify-between border-b border-surface-border/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">{display.ticker}</span>
                      {latest && (
                        <span className="text-xs font-mono text-text-secondary">{formatPrice(latest.price)}</span>
                      )}
                    </div>
                    {latest && (
                      <span
                        className={`text-xs font-medium ${latest.change24h >= 0 ? 'text-gain' : 'text-loss'}`}
                      >
                        {latest.change24h >= 0 ? '+' : ''}{latest.change24h.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <StreamingChart
                      symbol={sym}
                      height={120}
                      type="line"
                      maxPoints={100}
                      showStats={false}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
