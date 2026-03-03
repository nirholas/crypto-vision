'use client';

import React, { useState, useEffect } from 'react';
import { X, Bell, TrendingUp, TrendingDown, Percent, AlertCircle, Check } from 'lucide-react';
import { useAlerts, PriceAlert } from './AlertsProvider';
import { useToast } from '@/components/Toast';

interface PriceAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  currentPrice: number;
}

type AlertCondition = 'above' | 'below' | 'percent_up' | 'percent_down';

export function PriceAlertModal({
  isOpen,
  onClose,
  coinId,
  coinName,
  coinSymbol,
  currentPrice,
}: PriceAlertModalProps) {
  const { addAlert, getAlertsForCoin, removeAlert } = useAlerts();
  const { addToast } = useToast();

  const [condition, setCondition] = useState<AlertCondition>('above');
  const [targetPrice, setTargetPrice] = useState('');
  const [targetPercent, setTargetPercent] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [notifyBrowser, setNotifyBrowser] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get existing alerts for this coin
  const existingAlerts = getAlertsForCoin(coinId);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCondition('above');
      setTargetPrice('');
      setTargetPercent('');
      setRepeat(false);
      setNotifyBrowser(true);
      setError(null);
    }
  }, [isOpen]);

  // Set default target price based on condition
  useEffect(() => {
    if (condition === 'above') {
      setTargetPrice((currentPrice * 1.05).toFixed(2)); // 5% above
    } else if (condition === 'below') {
      setTargetPrice((currentPrice * 0.95).toFixed(2)); // 5% below
    }
  }, [condition, currentPrice]);

  const isPercentCondition = condition === 'percent_up' || condition === 'percent_down';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (isPercentCondition) {
      const percent = parseFloat(targetPercent);
      if (isNaN(percent) || percent <= 0 || percent > 1000) {
        setError('Please enter a valid percentage (1-1000%)');
        return;
      }
    } else {
      const price = parseFloat(targetPrice);
      if (isNaN(price) || price <= 0) {
        setError('Please enter a valid price');
        return;
      }

      // Warning for potentially wrong direction
      if (condition === 'above' && price <= currentPrice) {
        setError('Target price is already above current price. Alert will trigger immediately.');
        // Allow to proceed anyway
      }
      if (condition === 'below' && price >= currentPrice) {
        setError('Target price is already below current price. Alert will trigger immediately.');
        // Allow to proceed anyway
      }
    }

    const result = addAlert({
      coinId,
      coinName,
      coinSymbol,
      condition,
      targetPrice: isPercentCondition ? currentPrice : parseFloat(targetPrice),
      targetPercent: isPercentCondition ? parseFloat(targetPercent) : undefined,
      createdPrice: currentPrice,
      repeat,
      notifyBrowser,
    });

    if (result.success) {
      addToast({
        type: 'success',
        title: 'Alert created',
        message: `You'll be notified when ${coinSymbol.toUpperCase()} ${getConditionText(condition, isPercentCondition ? parseFloat(targetPercent) : parseFloat(targetPrice), isPercentCondition)}`,
        duration: 4000,
      });
      onClose();
    } else {
      setError(result.error || 'Failed to create alert');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary">Price Alert</h2>
              <p className="text-sm text-text-muted">
                {coinName} ({coinSymbol.toUpperCase()})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Price */}
        <div className="px-6 py-4 bg-surface-alt">
          <p className="text-sm text-text-muted">Current Price</p>
          <p className="text-2xl font-bold text-text-primary">
            $
            {currentPrice.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Condition Type */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Alert me when price
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCondition('above')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  condition === 'above'
                    ? 'border-gain bg-gain/10 text-gain'
                    : 'border-surface-border text-text-muted hover:border-surface-border'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Goes Above
              </button>
              <button
                type="button"
                onClick={() => setCondition('below')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  condition === 'below'
                    ? 'border-loss bg-loss/10 text-loss'
                    : 'border-surface-border text-text-muted hover:border-surface-border'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Goes Below
              </button>
              <button
                type="button"
                onClick={() => setCondition('percent_up')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  condition === 'percent_up'
                    ? 'border-gain bg-gain/10 text-gain'
                    : 'border-surface-border text-text-muted hover:border-surface-border'
                }`}
              >
                <Percent className="w-4 h-4" />
                Up By %
              </button>
              <button
                type="button"
                onClick={() => setCondition('percent_down')}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                  condition === 'percent_down'
                    ? 'border-loss bg-loss/10 text-loss'
                    : 'border-surface-border text-text-muted hover:border-surface-border'
                }`}
              >
                <Percent className="w-4 h-4" />
                Down By %
              </button>
            </div>
          </div>

          {/* Target Price/Percent */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {isPercentCondition ? 'Target Percentage Change' : 'Target Price'}
            </label>
            {isPercentCondition ? (
              <div className="relative">
                <input
                  type="number"
                  value={targetPercent}
                  onChange={(e) => setTargetPercent(e.target.value)}
                  placeholder="e.g. 10"
                  step="0.1"
                  min="0.1"
                  max="1000"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">%</span>
              </div>
            ) : (
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="0.00"
                  step="any"
                  min="0"
                  className="w-full px-4 py-3 pl-8 rounded-xl border border-surface-border bg-surface text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            )}
            {!isPercentCondition && targetPrice && (
              <p className="mt-1 text-sm text-text-muted">
                {(((parseFloat(targetPrice) - currentPrice) / currentPrice) * 100).toFixed(2)}%{' '}
                {parseFloat(targetPrice) >= currentPrice ? 'above' : 'below'} current price
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
                className="w-4 h-4 rounded border-surface-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-text-secondary">
                Repeat alert (notify every time condition is met)
              </span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyBrowser}
                onChange={(e) => setNotifyBrowser(e.target.checked)}
                className="w-4 h-4 rounded border-surface-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-text-secondary">
                Browser notification (requires permission)
              </span>
            </label>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2 text-warning">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Bell className="w-5 h-5" />
            Create Alert
          </button>
        </form>

        {/* Existing Alerts */}
        {existingAlerts.length > 0 && (
          <div className="px-6 pb-6">
            <div className="border-t border-surface-border pt-4">
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                Active Alerts for {coinSymbol.toUpperCase()}
              </h3>
              <div className="space-y-2">
                {existingAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      alert.triggered ? 'bg-gain/10' : 'bg-surface-alt'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {alert.triggered ? (
                        <Check className="w-4 h-4 text-gain" />
                      ) : (
                        <Bell className="w-4 h-4 text-text-muted" />
                      )}
                      <span className="text-sm text-text-secondary">
                        {getConditionText(
                          alert.condition,
                          alert.targetPercent || alert.targetPrice,
                          !!alert.targetPercent
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className="text-xs text-loss hover:underline"
                    >
                      Remove
                    </button>
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

function getConditionText(condition: AlertCondition, value: number, isPercent: boolean): string {
  if (isPercent) {
    switch (condition) {
      case 'percent_up':
        return `increases by ${value}%`;
      case 'percent_down':
        return `decreases by ${value}%`;
      default:
        return `changes by ${value}%`;
    }
  }

  const priceStr = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
  switch (condition) {
    case 'above':
      return `goes above ${priceStr}`;
    case 'below':
      return `goes below ${priceStr}`;
    default:
      return `reaches ${priceStr}`;
  }
}

export default PriceAlertModal;
