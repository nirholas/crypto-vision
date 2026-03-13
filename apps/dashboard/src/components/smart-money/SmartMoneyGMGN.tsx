/**
 * Smart Money GMGN Dashboard — Client Wrapper
 *
 * Composes three visualization components:
 * 1. TradeFlowNetwork (hero) — animated canvas node graph
 * 2. TradeFeed — GMGN-style live trade stream
 * 3. WalletRankings — filterable wallet card grid
 *
 * Receives serialized data from the server component and
 * manages client-side state (tab selection, filters).
 */

'use client';

import { useState } from 'react';
import { Activity, Users, Zap, Network, TrendingUp } from 'lucide-react';
import { TradeFlowNetwork } from '@/components/smart-money/TradeFlowNetwork';
import { TradeFeed } from '@/components/smart-money/TradeFeed';
import { WalletRankings } from '@/components/smart-money/WalletRankings';
import type { SimulatedTrade, SmartWallet, KOLWallet, TrendingToken } from '@/lib/smart-money-data';

// ─── Props ──────────────────────────────────────────────────

interface SmartMoneyGMGNProps {
  trades: SimulatedTrade[];
  wallets: SmartWallet[];
  kolWallets: KOLWallet[];
  trending: TrendingToken[];
  stats: {
    totalWallets: number;
    totalKOLs: number;
    totalTrades: number;
    chains: number;
  };
}

// ─── Component ──────────────────────────────────────────────

export function SmartMoneyGMGN({
  trades,
  wallets,
  kolWallets,
  trending,
  stats,
}: SmartMoneyGMGNProps) {
  const [activeSection, setActiveSection] = useState<'flow' | 'feed' | 'wallets'>('flow');

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#00ff00] flex items-center justify-center">
              <Network size={18} className="text-white" />
            </div>
            Smart Money Live
          </h1>
          <p className="text-sm text-[#666] mt-1">
            Real-time wallet intelligence from{' '}
            <span className="text-[#9945FF]">Solana</span> &amp;{' '}
            <span className="text-[#F0B90B]">BSC</span> smart money
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#666]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#00ff00] animate-pulse" />
            Live
          </div>
          <span className="font-mono">{stats.totalWallets.toLocaleString()} wallets</span>
          <span className="font-mono">{stats.totalKOLs.toLocaleString()} KOLs</span>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users size={14} />}
          label="Smart Wallets"
          value={stats.totalWallets.toLocaleString()}
          color="#9945FF"
        />
        <StatCard
          icon={<Activity size={14} />}
          label="Simulated Trades"
          value={stats.totalTrades.toLocaleString()}
          color="#00ff00"
        />
        <StatCard
          icon={<TrendingUp size={14} />}
          label="Trending Tokens"
          value={trending.length.toString()}
          color="#00d4aa"
        />
        <StatCard
          icon={<Zap size={14} />}
          label="KOL Wallets"
          value={stats.totalKOLs.toLocaleString()}
          color="#F0B90B"
        />
      </div>

      {/* ── Section Tabs ── */}
      <div className="flex items-center gap-1 bg-[#0a0a0a] p-1 rounded-xl border border-[#1a1a1a] w-fit">
        {([
          { id: 'flow' as const, label: 'Trade Flow', icon: Network },
          { id: 'feed' as const, label: 'Live Feed', icon: Activity },
          { id: 'wallets' as const, label: 'Wallet Rankings', icon: Users },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeSection === id
                ? 'bg-[#141414] text-white shadow-sm border border-[#222]'
                : 'text-[#666] hover:text-[#999]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {activeSection === 'flow' && (
        <div className="space-y-4">
          <div className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] overflow-hidden">
            <TradeFlowNetwork trades={trades} className="h-[600px]" />
          </div>
          <p className="text-[10px] text-[#444] text-center font-mono">
            Hover over nodes to inspect wallets and tokens. Particles show trade flow direction: green = buy, red = sell.
          </p>
        </div>
      )}

      {activeSection === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TradeFeed trades={trades} className="h-[700px]" />
          </div>
          <div className="space-y-4">
            {/* Trending tokens sidebar */}
            <div className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-4">
              <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp size={12} className="text-[#00d4aa]" />
                Trending Tokens
              </h3>
              <div className="space-y-2">
                {trending.slice(0, 15).map((token, i) => (
                  <div
                    key={`${token.chain}-${token.address}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="text-[#444] font-mono w-4">{i + 1}</span>
                    {token.logo && (
                      <img
                        src={token.logo}
                        alt=""
                        className="w-5 h-5 rounded-full"
                        loading="lazy"
                      />
                    )}
                    <span className="text-white font-medium truncate flex-1">
                      {token.symbol}
                    </span>
                    <span
                      className={`font-mono ${
                        token.price_change_percent >= 0
                          ? 'text-[#00ff00]'
                          : 'text-[#ff0000]'
                      }`}
                    >
                      {token.price_change_percent >= 0 ? '+' : ''}
                      {token.price_change_percent.toFixed(1)}%
                    </span>
                    <span
                      className="text-[9px] px-1 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          token.chain === 'sol'
                            ? 'rgba(153,69,255,0.15)'
                            : 'rgba(240,185,11,0.15)',
                        color: token.chain === 'sol' ? '#9945FF' : '#F0B90B',
                      }}
                    >
                      {token.chain.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'wallets' && (
        <WalletRankings wallets={wallets} kolWallets={kolWallets} />
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 flex items-center gap-3"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div>
        <div className="text-[10px] text-[#555] uppercase tracking-wider">{label}</div>
        <div className="text-sm font-bold text-white font-mono">{value}</div>
      </div>
    </div>
  );
}
