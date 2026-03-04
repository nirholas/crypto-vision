'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  DollarSign,
  Bell,
  Volume2,
  VolumeX,
  LayoutGrid,
  List,
  Clock,
  LineChart,
  CandlestickChart,
  Trash2,
  Download,
  Upload,
  Info,
  Check,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import PageLayout from '@/components/PageLayout';
import { NotificationSettings } from '@/components/NotificationSettings';
import { PushNotifications } from '@/components/PushNotifications';

// Preferences types
interface UserPreferences {
  currency: 'USD' | 'EUR' | 'GBP' | 'BTC' | 'ETH';
  priceChangePeriod: '1h' | '24h' | '7d';
  defaultChartType: 'line' | 'candlestick';
  defaultTimeRange: '24h' | '7d' | '30d' | '90d';
  notifications: boolean;
  soundEffects: boolean;
  compactView: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  currency: 'USD',
  priceChangePeriod: '24h',
  defaultChartType: 'line',
  defaultTimeRange: '7d',
  notifications: true,
  soundEffects: false,
  compactView: false,
};

const STORAGE_KEY = 'crypto-user-preferences';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');

  // Load preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
      }
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Save preferences
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        console.error('Failed to save preferences');
      }
    }
  }, [preferences, isLoaded]);

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    addToast({ type: 'success', title: 'Setting saved', duration: 2000 });
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        updatePreference('notifications', true);
        addToast({ type: 'success', title: 'Notifications enabled' });
      } else {
        addToast({ type: 'error', title: 'Notification permission denied' });
      }
    }
  };

  const clearAllData = () => {
    if (
      confirm(
        'This will clear all your local data including watchlist, portfolio, alerts, and preferences. Continue?'
      )
    ) {
      // Clear all crypto-related localStorage items
      const keysToRemove = Object.keys(localStorage).filter(
        (key) => key.startsWith('crypto-') || key === STORAGE_KEY
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));

      // Reset preferences
      setPreferences(DEFAULT_PREFERENCES);

      addToast({ type: 'success', title: 'All data cleared' });
    }
  };

  const exportAllData = () => {
    const data: Record<string, unknown> = {};
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('crypto-') || key === STORAGE_KEY) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) || '');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crypto-data-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addToast({ type: 'success', title: 'Data exported' });
  };

  const currencies = [
    { value: 'USD', label: 'US Dollar', symbol: '$' },
    { value: 'EUR', label: 'Euro', symbol: '€' },
    { value: 'GBP', label: 'British Pound', symbol: '£' },
    { value: 'BTC', label: 'Bitcoin', symbol: '₿' },
    { value: 'ETH', label: 'Ethereum', symbol: 'Ξ' },
  ];

  if (!isLoaded) {
    return (
      <PageLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-[var(--surface)] rounded-lg w-48" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-[var(--surface)] rounded-2xl" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-8 h-8 text-[var(--text-secondary)]" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <div className="space-y-6">
          {/* Theme */}
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-6">
            <h2 className="text-lg font-semibold mb-4">Appearance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                  Theme
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'light', icon: Sun, label: 'Light' },
                    { value: 'dark', icon: Moon, label: 'Dark' },
                    { value: 'system', icon: Monitor, label: 'System' },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        theme === value
                          ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                          : 'border-surface-border hover:border-surface-border'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          theme === value ? 'text-primary' : 'text-text-muted'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          theme === value ? 'text-primary' : 'text-text-secondary'
                        }`}
                      >
                        {label}
                      </span>
                      {theme === value && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-surface-border">
                <div>
                  <p className="font-medium text-text-primary">Compact View</p>
                  <p className="text-sm text-text-muted">Show more items with less spacing</p>
                </div>
                <button
                  onClick={() => updatePreference('compactView', !preferences.compactView)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.compactView ? 'bg-primary' : 'bg-surface-hover'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences.compactView ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Currency & Display */}
          <div className="bg-surface rounded-2xl border border-surface-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Display Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Default Currency
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {currencies.map(({ value, label, symbol }) => (
                    <button
                      key={value}
                      onClick={() =>
                        updatePreference('currency', value as UserPreferences['currency'])
                      }
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                        preferences.currency === value
                          ? 'border-primary bg-primary/10'
                          : 'border-surface-border hover:border-surface-border'
                      }`}
                    >
                      <span className="text-lg">{symbol}</span>
                      <span className="text-xs text-text-muted">{value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Price Change Period
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['1h', '24h', '7d'].map((period) => (
                    <button
                      key={period}
                      onClick={() =>
                        updatePreference(
                          'priceChangePeriod',
                          period as UserPreferences['priceChangePeriod']
                        )
                      }
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        preferences.priceChangePeriod === period
                          ? 'border-primary bg-primary/10'
                          : 'border-surface-border hover:border-surface-border'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">{period}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Default Chart Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'line', icon: LineChart, label: 'Line' },
                    { value: 'candlestick', icon: CandlestickChart, label: 'Candlestick' },
                  ].map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() =>
                        updatePreference(
                          'defaultChartType',
                          value as UserPreferences['defaultChartType']
                        )
                      }
                      className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        preferences.defaultChartType === value
                          ? 'border-primary bg-primary/10'
                          : 'border-surface-border hover:border-surface-border'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Default Time Range
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['24h', '7d', '30d', '90d'].map((range) => (
                    <button
                      key={range}
                      onClick={() =>
                        updatePreference(
                          'defaultTimeRange',
                          range as UserPreferences['defaultTimeRange']
                        )
                      }
                      className={`p-3 rounded-xl border-2 transition-all font-medium ${
                        preferences.defaultTimeRange === range
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-surface-border hover:border-surface-border text-text-secondary'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-surface rounded-2xl border border-surface-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Notifications</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-text-muted" />
                  <div>
                    <p className="font-medium text-text-primary">Browser Notifications</p>
                    <p className="text-sm text-text-muted">
                      Get notified when price alerts trigger
                    </p>
                  </div>
                </div>
                {notificationPermission === 'granted' ? (
                  <button
                    onClick={() => updatePreference('notifications', !preferences.notifications)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      preferences.notifications ? 'bg-primary' : 'bg-surface-hover'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        preferences.notifications ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                ) : (
                  <button
                    onClick={requestNotificationPermission}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium"
                  >
                    Enable
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between py-3 border-t border-surface-border">
                <div className="flex items-center gap-3">
                  {preferences.soundEffects ? (
                    <Volume2 className="w-5 h-5 text-text-muted" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-text-muted" />
                  )}
                  <div>
                    <p className="font-medium text-text-primary">Sound Effects</p>
                    <p className="text-sm text-text-muted">Play sounds for notifications</p>
                  </div>
                </div>
                <button
                  onClick={() => updatePreference('soundEffects', !preferences.soundEffects)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.soundEffects ? 'bg-primary' : 'bg-surface-hover'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      preferences.soundEffects ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Notification Settings */}
          <div className="bg-surface rounded-2xl border border-surface-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Push Notifications</h2>
            <NotificationSettings className="mb-4" />
            <PushNotifications />
          </div>

          {/* Data Management */}
          <div className="bg-surface rounded-2xl border border-surface-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Data Management</h2>
            <div className="space-y-3">
              <button
                onClick={exportAllData}
                className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Download className="w-5 h-5 text-text-muted" />
                  <div className="text-left">
                    <p className="font-medium text-text-primary">Export All Data</p>
                    <p className="text-sm text-text-muted">
                      Download watchlist, portfolio, alerts, and settings
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={clearAllData}
                className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-loss/10 transition-colors text-loss"
              >
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-medium">Clear All Data</p>
                    <p className="text-sm opacity-70">Remove all local data (cannot be undone)</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* About */}
          <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-6">
            <h2 className="text-lg font-semibold mb-4">About</h2>
            <div className="flex items-start gap-3 text-[var(--text-secondary)]">
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="mb-2">
                  Free Crypto News is an open-source cryptocurrency news and market data platform.
                </p>
                <p>All data is stored locally in your browser. No account required.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
