'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  History,
} from 'lucide-react';
import { Holding } from './PortfolioProvider';

interface HoldingWithPrice extends Holding {
  currentPrice: number;
  change24h: number;
  value: number;
  profitLoss: number;
  profitLossPercent: number;
  allocation: number;
  image?: string;
}

interface HoldingsTableProps {
  holdings: HoldingWithPrice[];
  onAddTransaction?: (coinId: string) => void;
  onSellTransaction?: (coinId: string) => void;
  isLoading?: boolean;
}

export function HoldingsTable({
  holdings,
  onAddTransaction,
  onSellTransaction,
  isLoading = false,
}: HoldingsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'value' | 'profitLoss' | 'change24h'>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const sortedHoldings = [...holdings].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'value':
        comparison = a.value - b.value;
        break;
      case 'profitLoss':
        comparison = a.profitLoss - b.profitLoss;
        break;
      case 'change24h':
        comparison = a.change24h - b.change24h;
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
        <div className="animate-pulse p-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-surface-alt rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (holdings.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="px-6 py-4 text-left text-sm font-semibold text-text-muted">Asset</th>
              <th className="px-4 py-4 text-right text-sm font-semibold text-text-muted">
                Holdings
              </th>
              <th className="px-4 py-4 text-right text-sm font-semibold text-text-muted">
                Avg. Buy
              </th>
              <th className="px-4 py-4 text-right text-sm font-semibold text-text-muted">
                Current Price
              </th>
              <th className="px-4 py-4 text-right">
                <button
                  onClick={() => handleSort('value')}
                  className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary ml-auto"
                >
                  Value
                  {sortField === 'value' &&
                    (sortDirection === 'asc' ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>
              </th>
              <th className="px-4 py-4 text-right">
                <button
                  onClick={() => handleSort('profitLoss')}
                  className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary ml-auto"
                >
                  P&L
                  {sortField === 'profitLoss' &&
                    (sortDirection === 'asc' ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>
              </th>
              <th className="px-4 py-4 text-right hidden md:table-cell">
                <button
                  onClick={() => handleSort('change24h')}
                  className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-primary ml-auto"
                >
                  24h
                  {sortField === 'change24h' &&
                    (sortDirection === 'asc' ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>
              </th>
              <th className="px-4 py-4 text-right text-sm font-semibold text-text-muted">
                Allocation
              </th>
              <th className="px-4 py-4 text-right text-sm font-semibold text-text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding) => (
              <React.Fragment key={holding.coinId}>
                <tr className="border-b border-surface-border/50 hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/coin/${holding.coinId}`}
                      className="flex items-center gap-3 group"
                    >
                      {holding.image ? (
                        <img
                          src={holding.image}
                          alt={holding.coinName}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-sm font-bold text-text-muted">
                          {holding.coinSymbol.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                          {holding.coinName}
                        </p>
                        <p className="text-sm text-text-muted">
                          {holding.coinSymbol.toUpperCase()}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-medium text-text-primary">
                      {holding.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                    </p>
                    <p className="text-sm text-text-muted">{holding.coinSymbol.toUpperCase()}</p>
                  </td>
                  <td className="px-4 py-4 text-right text-text-secondary">
                    $
                    {holding.averageBuyPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: holding.averageBuyPrice < 1 ? 6 : 2,
                    })}
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-text-primary">
                    $
                    {holding.currentPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: holding.currentPrice < 1 ? 6 : 2,
                    })}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-text-primary">
                    $
                    {holding.value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div
                      className={`flex items-center justify-end gap-1 font-medium ${
                        holding.profitLoss >= 0
                          ? 'text-gain'
                          : 'text-loss'
                      }`}
                    >
                      {holding.profitLoss >= 0 ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                      <div>
                        <p>
                          {holding.profitLoss >= 0 ? '+' : '-'}$
                          {Math.abs(holding.profitLoss).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs">
                          {holding.profitLoss >= 0 ? '+' : ''}
                          {holding.profitLossPercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right hidden md:table-cell">
                    <span
                      className={`font-medium ${
                        holding.change24h >= 0
                          ? 'text-gain'
                          : 'text-loss'
                      }`}
                    >
                      {holding.change24h >= 0 ? '+' : ''}
                      {holding.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-2 bg-surface-alt rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(holding.allocation, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-text-secondary w-12">
                        {holding.allocation.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onAddTransaction && (
                        <button
                          onClick={() => onAddTransaction(holding.coinId)}
                          className="p-2 rounded-lg hover:bg-gain/20 text-text-muted hover:text-gain transition-colors"
                          title="Buy more"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      {onSellTransaction && (
                        <button
                          onClick={() => onSellTransaction(holding.coinId)}
                          className="p-2 rounded-lg hover:bg-loss/20 text-text-muted hover:text-loss transition-colors"
                          title="Sell"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() =>
                          setExpandedRow(expandedRow === holding.coinId ? null : holding.coinId)
                        }
                        className="p-2 rounded-lg hover:bg-surface-alt text-text-muted transition-colors"
                        title="Transaction history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded transaction history */}
                {expandedRow === holding.coinId && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 bg-surface-alt/50">
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-text-secondary mb-3">
                          Transaction History
                        </h4>
                        {holding.transactions.length > 0 ? (
                          <div className="space-y-2">
                            {holding.transactions
                              .slice()
                              .reverse()
                              .map((tx) => (
                                <div
                                  key={tx.id}
                                  className="flex items-center justify-between p-3 bg-surface rounded-lg border border-surface-border"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                        tx.type === 'buy' || tx.type === 'transfer_in'
                                          ? 'bg-gain/20 text-gain'
                                          : 'bg-loss/20 text-loss'
                                      }`}
                                    >
                                      {tx.type === 'buy' || tx.type === 'transfer_in' ? (
                                        <Plus className="w-4 h-4" />
                                      ) : (
                                        <Minus className="w-4 h-4" />
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-medium text-text-primary capitalize">
                                        {tx.type.replace('_', ' ')}
                                      </p>
                                      <p className="text-sm text-text-muted">
                                        {new Date(tx.date).toLocaleDateString()}
                                        {tx.exchange && ` • ${tx.exchange}`}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium text-text-primary">
                                      {tx.amount.toLocaleString()}{' '}
                                      {holding.coinSymbol.toUpperCase()}
                                    </p>
                                    <p className="text-sm text-text-muted">
                                      @ ${tx.pricePerCoin.toLocaleString()} = $
                                      {tx.totalValue.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-text-muted text-sm">No transactions</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HoldingsTable;
