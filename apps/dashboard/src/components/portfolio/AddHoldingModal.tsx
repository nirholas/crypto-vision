'use client';

import React, { useState } from 'react';
import { X, Search, Calendar, DollarSign, FileText, Building } from 'lucide-react';
import { usePortfolio, Transaction } from './PortfolioProvider';
import { useToast } from '@/components/Toast';

interface AddHoldingModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledCoin?: {
    id: string;
    name: string;
    symbol: string;
    currentPrice?: number;
  };
}

const POPULAR_COINS = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
];

type TransactionType = Transaction['type'];

export function AddHoldingModal({ isOpen, onClose, prefilledCoin }: AddHoldingModalProps) {
  const { addTransaction, getHolding } = usePortfolio();
  const { addToast } = useToast();

  const [step, setStep] = useState<'coin' | 'details'>(prefilledCoin ? 'details' : 'coin');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCoin, setSelectedCoin] = useState(prefilledCoin || null);

  const [txType, setTxType] = useState<TransactionType>('buy');
  const [amount, setAmount] = useState('');
  const [pricePerCoin, setPricePerCoin] = useState(prefilledCoin?.currentPrice?.toString() || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [exchange, setExchange] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filteredCoins = searchQuery
    ? POPULAR_COINS.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_COINS;

  const totalValue = parseFloat(amount || '0') * parseFloat(pricePerCoin || '0');
  const existingHolding = selectedCoin ? getHolding(selectedCoin.id) : null;

  const handleSelectCoin = (coin: (typeof POPULAR_COINS)[0]) => {
    setSelectedCoin(coin);
    setStep('details');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCoin) {
      setError('Please select a coin');
      return;
    }

    const amountNum = parseFloat(amount);
    const priceNum = parseFloat(pricePerCoin);

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price');
      return;
    }

    const result = addTransaction({
      coinId: selectedCoin.id,
      coinSymbol: selectedCoin.symbol,
      coinName: selectedCoin.name,
      type: txType,
      amount: amountNum,
      pricePerCoin: priceNum,
      totalValue: amountNum * priceNum,
      date: new Date(date).toISOString(),
      notes: notes || undefined,
      exchange: exchange || undefined,
    });

    if (result.success) {
      addToast({
        type: 'success',
        title: 'Transaction added',
        message: `${txType === 'buy' ? 'Bought' : txType === 'sell' ? 'Sold' : 'Added'} ${amountNum} ${selectedCoin.symbol.toUpperCase()}`,
        duration: 4000,
      });
      onClose();
      // Reset form
      setStep('coin');
      setSelectedCoin(null);
      setAmount('');
      setPricePerCoin('');
      setNotes('');
      setExchange('');
    } else {
      setError(result.error || 'Failed to add transaction');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-text-primary">
              {step === 'coin' ? 'Select Coin' : 'Add Transaction'}
            </h2>
            {selectedCoin && step === 'details' && (
              <p className="text-sm text-text-muted">
                {selectedCoin.name} ({selectedCoin.symbol.toUpperCase()})
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-alt text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {step === 'coin' ? (
          <div className="p-6">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search coins..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </div>

            {/* Coin list */}
            <div className="space-y-2">
              {filteredCoins.slice(0, 8).map((coin) => (
                <button
                  key={coin.id}
                  onClick={() => handleSelectCoin(coin)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center text-sm font-bold text-text-muted">
                    {coin.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">{coin.name}</p>
                    <p className="text-sm text-text-muted">{coin.symbol.toUpperCase()}</p>
                  </div>
                </button>
              ))}
              {filteredCoins.length > 8 && (
                <p className="text-center py-2 text-text-muted text-sm">Type to search {filteredCoins.length - 8} more coins...</p>
              )}
              {filteredCoins.length === 0 && (
                <p className="text-center py-8 text-text-muted">No coins found</p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Change coin */}
            {!prefilledCoin && (
              <button
                type="button"
                onClick={() => setStep('coin')}
                className="text-sm text-primary hover:underline"
              >
                ← Change coin
              </button>
            )}

            {/* Existing holding info */}
            {existingHolding && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <p className="text-sm text-primary">
                  Current holding: {existingHolding.amount.toLocaleString()}{' '}
                  {selectedCoin?.symbol.toUpperCase()}
                  <span className="text-primary/70">
                    {' '}
                    (avg. ${existingHolding.averageBuyPrice.toFixed(2)})
                  </span>
                </p>
              </div>
            )}

            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Transaction Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['buy', 'sell', 'transfer_in', 'transfer_out'] as TransactionType[]).map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTxType(type)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        txType === type
                          ? type === 'buy' || type === 'transfer_in'
                            ? 'bg-gain/20 text-gain border-2 border-gain'
                            : 'bg-loss/20 text-loss border-2 border-loss'
                          : 'bg-surface-alt text-text-secondary border-2 border-transparent'
                      }`}
                    >
                      {type === 'transfer_in'
                        ? 'Transfer In'
                        : type === 'transfer_out'
                          ? 'Transfer Out'
                          : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="any"
                  min="0"
                  className="w-full px-4 py-3 pr-16 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">
                  {selectedCoin?.symbol.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Price per coin */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Price per Coin
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="number"
                  value={pricePerCoin}
                  onChange={(e) => setPricePerCoin(e.target.value)}
                  placeholder="0.00"
                  step="any"
                  min="0"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              {totalValue > 0 && (
                <p className="mt-1 text-sm text-text-muted">
                  Total: $
                  {totalValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Exchange (optional)
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    placeholder="e.g. Coinbase"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Notes (optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add note..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-loss/10 border border-loss/30 text-loss text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors ${
                txType === 'buy' || txType === 'transfer_in'
                  ? 'bg-gain hover:bg-gain/90 text-white'
                  : 'bg-loss hover:bg-loss/90 text-white'
              }`}
            >
              {txType === 'buy'
                ? 'Add Buy'
                : txType === 'sell'
                  ? 'Add Sell'
                  : txType === 'transfer_in'
                    ? 'Add Transfer In'
                    : 'Add Transfer Out'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddHoldingModal;
