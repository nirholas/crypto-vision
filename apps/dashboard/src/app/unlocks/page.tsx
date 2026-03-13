/**
 * Token Unlocks Dashboard — Vesting Schedules & Emission Tracking
 *
 * Monitors token unlock schedules and emission events for top DeFi protocols.
 * Data sourced from DeFiLlama protocol metrics.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getTokenUnlocks,
  formatLargeNumber,
  formatPercentChange,
  changeColor,
  changeBg,
} from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Unlock, Calendar, AlertTriangle, TrendingDown, Clock, DollarSign } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Token Unlocks — Vesting & Emission Schedules | Crypto Vision',
  description:
    'Track upcoming token unlocks and vesting schedules for top DeFi protocols. Monitor supply-side pressure from emissions.',
};

export const revalidate = 300;

export default async function UnlocksPage() {
  const unlocks = await getTokenUnlocks();

  // Sort by next unlock date
  const sorted = [...unlocks].sort(
    (a, b) => new Date(a.nextUnlockDate).getTime() - new Date(b.nextUnlockDate).getTime()
  );

  // Stats
  const totalLocked = unlocks.reduce((s, u) => s + u.totalLockedUsd, 0);
  const upcomingWeek = sorted.filter((u) => {
    const days =
      (new Date(u.nextUnlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  });
  const upcomingMonth = sorted.filter((u) => {
    const days =
      (new Date(u.nextUnlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  });

  const totalUnlockValueWeek = upcomingWeek.reduce(
    (s, u) => s + u.nextUnlockAmountUsd,
    0
  );

  // Category breakdown
  const categoryMap = new Map<string, number>();
  for (const u of unlocks) {
    categoryMap.set(
      u.category,
      (categoryMap.get(u.category) || 0) + u.totalLockedUsd
    );
  }
  const categories = [...categoryMap.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Unlock size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Token Unlocks</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Vesting schedules, emission tracking & supply-side analysis
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={14} className="text-rose-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Total Locked
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatLargeNumber(totalLocked)}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-amber-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Unlocking This Week
                </span>
              </div>
              <div className="text-xl font-bold text-amber-400">
                {formatLargeNumber(totalUnlockValueWeek)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {upcomingWeek.length} events
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar size={14} className="text-cyan-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  This Month
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {upcomingMonth.length} events
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Tracked Tokens
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {unlocks.length}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Unlocks Table */}
            <div className="lg:col-span-8">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Unlock size={16} className="text-rose-400" />
                    Upcoming Token Unlocks
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium">Token</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">
                          Category
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">Next Unlock</th>
                        <th className="text-right px-4 py-2.5 font-medium">Unlock Value</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">
                          Total Locked
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                          Days Until
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((u, i) => {
                        const daysUntil = Math.max(
                          0,
                          Math.round(
                            (new Date(u.nextUnlockDate).getTime() - Date.now()) /
                              (1000 * 60 * 60 * 24)
                          )
                        );
                        const urgency =
                          daysUntil <= 3
                            ? 'text-red-400'
                            : daysUntil <= 7
                              ? 'text-amber-400'
                              : 'text-[var(--text-muted)]';

                        return (
                          <tr
                            key={`${u.symbol}-${i}`}
                            className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-[var(--text-primary)]">
                                {u.name}
                              </div>
                              <div className="text-xs text-[var(--text-muted)] font-mono">
                                {u.symbol}
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-secondary)]">
                                {u.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                              {new Date(u.nextUnlockDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-[var(--text-primary)]">
                              {formatLargeNumber(u.nextUnlockAmountUsd)}
                            </td>
                            <td className="px-4 py-3 text-right hidden lg:table-cell font-mono text-[var(--text-secondary)]">
                              {formatLargeNumber(u.totalLockedUsd)}
                            </td>
                            <td className="px-4 py-3 text-right hidden md:table-cell">
                              <span className={`font-mono font-medium ${urgency}`}>
                                {daysUntil === 0 ? 'Today' : `${daysUntil}d`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sorted.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    No token unlock data available
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Category Breakdown */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Locked by Category
                </h3>
                {categories.map(([cat, val]) => {
                  const pct = totalLocked > 0 ? (val / totalLocked) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">{cat}</span>
                        <span className="font-mono text-[var(--text-primary)]">
                          {formatLargeNumber(val)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Imminent Unlocks */}
              {upcomingWeek.length > 0 && (
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    Unlocking This Week
                  </h3>
                  {upcomingWeek.slice(0, 5).map((u, i) => (
                    <div
                      key={`uw-${i}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {u.name}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {new Date(u.nextUnlockDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </div>
                      <div className="font-mono font-medium text-red-400">
                        {formatLargeNumber(u.nextUnlockAmountUsd)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
