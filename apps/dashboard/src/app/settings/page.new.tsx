'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings,
  Moon,
  DollarSign,
  Bell,
  Volume2,
  VolumeX,
  Clock,
  Trash2,
  Download,
  Upload,
  Info,
  Check,
  Palette,
  Globe,
  Keyboard,
  Database,
  Server,
  RefreshCw,
  ChevronRight,
  Minimize2,
  Maximize2,
  Mail,
  Zap,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import PageLayout from '@/components/PageLayout';
import { NotificationSettings } from '@/components/NotificationSettings';
import { PushNotifications } from '@/components/PushNotifications';

// ─── Types ───────────────────────────────────────────────────────────────────

type AccentColor = 'teal' | 'purple' | 'blue' | 'orange' | 'red';
type NumberFormat = 'comma-dot' | 'dot-comma';
type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'BTC' | 'ETH';
type RefreshInterval = '30' | '60' | '120' | '300' | 'off';

interface UserPreferences {
  currency: Currency;
  priceChangePeriod: '1h' | '24h' | '7d';
  defaultChartType: 'line' | 'candlestick';
  defaultTimeRange: '24h' | '7d' | '30d' | '90d';
  notifications: boolean;
  soundEffects: boolean;
  compactView: boolean;
  accentColor: AccentColor;
  numberFormat: NumberFormat;
  emailNotifications: boolean;
  apiUrl: string;
  swarmApiUrl: string;
  coingeckoApiKey: string;
  refreshInterval: RefreshInterval;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  currency: 'USD',
  priceChangePeriod: '24h',
  defaultChartType: 'line',
  defaultTimeRange: '7d',
  notifications: true,
  soundEffects: false,
  compactView: false,
  accentColor: 'teal',
  numberFormat: 'comma-dot',
  emailNotifications: false,
  apiUrl: 'http://localhost:8080',
  swarmApiUrl: 'http://localhost:3847',
  coingeckoApiKey: '',
  refreshInterval: '60',
};

const STORAGE_KEY = 'crypto-user-preferences';

const ACCENT_COLORS: { value: AccentColor; label: string; color: string; ring: string }[] = [
  { value: 'teal', label: 'Teal', color: 'bg-teal-500', ring: 'ring-teal-500' },
  { value: 'purple', label: 'Purple', color: 'bg-purple-500', ring: 'ring-purple-500' },
  { value: 'blue', label: 'Blue', color: 'bg-blue-500', ring: 'ring-blue-500' },
  { value: 'orange', label: 'Orange', color: 'bg-orange-500', ring: 'ring-orange-500' },
  { value: 'red', label: 'Red', color: 'bg-red-500', ring: 'ring-red-500' },
];

const CURRENCIES: { value: Currency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { value: 'BTC', label: 'Bitcoin', symbol: '₿' },
  { value: 'ETH', label: 'Ethereum', symbol: 'Ξ' },
];

const REFRESH_INTERVALS: { value: RefreshInterval; label: string }[] = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '300', label: '5 minutes' },
  { value: 'off', label: 'Off' },
];

const KEYBOARD_SHORTCUTS = [
  { category: 'Navigation', items: [
    { keys: ['⌘/Ctrl', 'K'], description: 'Global search' },
    { keys: ['⌘/Ctrl', '/'], description: 'Show shortcuts' },
    { keys: ['1-9'], description: 'Navigate sidebar items' },
    { keys: ['Esc'], description: 'Close modals' },
  ]},
  { category: 'Quick Access', items: [
    { keys: ['g', 'h'], description: 'Go to Home' },
    { keys: ['g', 't'], description: 'Go to Trending' },
    { keys: ['g', 'w'], description: 'Go to Watchlist' },
    { keys: ['g', 'p'], description: 'Go to Portfolio' },
    { keys: ['g', ','], description: 'Go to Settings' },
  ]},
  { category: 'Actions', items: [
    { keys: ['j'], description: 'Next article' },
    { keys: ['k'], description: 'Previous article' },
    { keys: ['w'], description: 'Toggle watchlist' },
    { keys: ['a'], description: 'Add price alert' },
    { keys: ['?'], description: 'Show shortcuts' },
  ]},
];

type SettingsSection = 'appearance' | 'currency' | 'notifications' | 'data' | 'api' | 'shortcuts' | 'about';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance');
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  // Force dark mode only
  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

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

    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Save preferences + sync between tabs
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        console.error('Failed to save preferences');
      }
    }
  }, [preferences, isLoaded]);

  // Cross-tab sync via storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(e.newValue) });
        } catch {
          // Ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
      addToast({ type: 'success', title: 'Setting saved', duration: 2000 });
    },
    [addToast]
  );

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
    if (confirm('This will clear all your local data including watchlist, portfolio, alerts, and preferences. Continue?')) {
      const keysToRemove = Object.keys(localStorage).filter(
        (key) => key.startsWith('crypto-') || key === STORAGE_KEY
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      setPreferences(DEFAULT_PREFERENCES);
      addToast({ type: 'success', title: 'All data cleared' });
    }
  };

  const clearApiCache = () => {
    const cacheKeys = Object.keys(localStorage).filter((key) => key.includes('cache') || key.includes('api-'));
    cacheKeys.forEach((key) => localStorage.removeItem(key));
    addToast({ type: 'success', title: `Cleared ${cacheKeys.length} cached items` });
  };

  const exportAllData = () => {
    const data: Record<string, unknown> = {};
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('crypto-') || key === STORAGE_KEY) {
        try {
          data[key] = JSON.parse(localStorage.getItem(key) ?? '');
        } catch {
          data[key] = localStorage.getItem(key);
        }
      }
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crypto-vision-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Data exported successfully' });
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as Record<string, unknown>;
        let importedCount = 0;
        Object.entries(data).forEach(([key, value]) => {
          if (key.startsWith('crypto-') || key === STORAGE_KEY) {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            importedCount++;
          }
        });

        // Refresh preferences
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(stored) });
        }

        addToast({ type: 'success', title: `Imported ${importedCount} items` });
      } catch {
        addToast({ type: 'error', title: 'Invalid backup file' });
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const sections: { id: SettingsSection; label: string; icon: typeof Settings }[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'currency', label: 'Currency', icon: DollarSign },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'api', label: 'API Config', icon: Server },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { id: 'about', label: 'About', icon: Info },
  ];

  if (!isLoaded) {
    return (
      <PageLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-[var(--brand)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
            <p className="text-sm text-[var(--text-muted)]">Customize your experience</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar nav */}
          <nav className="lg:w-56 flex-shrink-0">
            <div className="flex lg:flex-col gap-1 overflow-x-auto scrollbar-hide lg:overflow-visible">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                      activeSection === section.id
                        ? 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--surface-border)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface)]/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 space-y-6">
            {/* Appearance */}
            {activeSection === 'appearance' && (
              <div className="space-y-6 animate-fadeIn">
                <SettingsCard title="Theme" description="Dark mode only — designed for crypto traders">
                  <div className="flex items-center gap-3 p-4 bg-[var(--surface)]/50 rounded-xl border border-[var(--surface-border)]">
                    <Moon className="w-5 h-5 text-[var(--text-secondary)]" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">Dark Mode</p>
                      <p className="text-xs text-[var(--text-muted)]">Always on</p>
                    </div>
                    <div className="px-2 py-1 text-xs font-medium rounded-md bg-emerald-500/15 text-emerald-400">Active</div>
                  </div>
                </SettingsCard>

                <SettingsCard title="Accent Color" description="Choose your primary accent color">
                  <div className="flex gap-3">
                    {ACCENT_COLORS.map((ac) => (
                      <button
                        key={ac.value}
                        onClick={() => updatePreference('accentColor', ac.value)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          preferences.accentColor === ac.value
                            ? `border-current ${ac.ring} ring-2`
                            : 'border-[var(--surface-border)] hover:border-[var(--surface-hover)]'
                        }`}
                        title={ac.label}
                        aria-label={`${ac.label} accent color`}
                      >
                        <div className={`w-8 h-8 rounded-full ${ac.color}`} />
                        <span className="text-xs text-[var(--text-muted)]">{ac.label}</span>
                        {preferences.accentColor === ac.value && <Check className="w-3 h-3 text-[var(--text-primary)]" />}
                      </button>
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard title="Number Format" description="Choose how numbers are displayed">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => updatePreference('numberFormat', 'comma-dot')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        preferences.numberFormat === 'comma-dot'
                          ? 'border-[var(--brand)] bg-[var(--brand)]/10'
                          : 'border-[var(--surface-border)] hover:border-[var(--surface-hover)]'
                      }`}
                    >
                      <p className="text-lg font-mono font-medium text-[var(--text-primary)]">1,234.56</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">US / UK format</p>
                    </button>
                    <button
                      onClick={() => updatePreference('numberFormat', 'dot-comma')}
                      className={`p-4 rounded-xl border-2 transition-all text-center ${
                        preferences.numberFormat === 'dot-comma'
                          ? 'border-[var(--brand)] bg-[var(--brand)]/10'
                          : 'border-[var(--surface-border)] hover:border-[var(--surface-hover)]'
                      }`}
                    >
                      <p className="text-lg font-mono font-medium text-[var(--text-primary)]">1.234,56</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">EU format</p>
                    </button>
                  </div>
                </SettingsCard>

                <SettingsCard title="Compact Mode" description="Show more content with less spacing">
                  <ToggleRow
                    icon={preferences.compactView ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    label="Compact View"
                    description="Denser UI with tighter spacing"
                    checked={preferences.compactView}
                    onChange={(v) => updatePreference('compactView', v)}
                  />
                </SettingsCard>
              </div>
            )}

            {/* Currency */}
            {activeSection === 'currency' && (
              <div className="space-y-6 animate-fadeIn">
                <SettingsCard title="Default Currency" description="Set your preferred display currency">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {CURRENCIES.map(({ value, label, symbol }) => (
                      <button
                        key={value}
                        onClick={() => updatePreference('currency', value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          preferences.currency === value
                            ? 'border-[var(--brand)] bg-[var(--brand)]/10'
                            : 'border-[var(--surface-border)] hover:border-[var(--surface-hover)]'
                        }`}
                      >
                        <span className="text-xl">{symbol}</span>
                        <span className="text-xs text-[var(--text-muted)]">{value}</span>
                      </button>
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard title="Price Change Period" description="Default time period for price changes">
                  <div className="grid grid-cols-3 gap-3">
                    {['1h', '24h', '7d'].map((period) => (
                      <button
                        key={period}
                        onClick={() => updatePreference('priceChangePeriod', period as UserPreferences['priceChangePeriod'])}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          preferences.priceChangePeriod === period
                            ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                            : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--surface-hover)]'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">{period}</span>
                      </button>
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard title="Default Time Range" description="Default chart time range">
                  <div className="grid grid-cols-4 gap-2">
                    {['24h', '7d', '30d', '90d'].map((range) => (
                      <button
                        key={range}
                        onClick={() => updatePreference('defaultTimeRange', range as UserPreferences['defaultTimeRange'])}
                        className={`p-3 rounded-xl border-2 transition-all font-medium text-sm ${
                          preferences.defaultTimeRange === range
                            ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                            : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--surface-hover)]'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="space-y-6 animate-fadeIn">
                <SettingsCard title="Browser Notifications" description="Get notified when alerts trigger">
                  <div className="space-y-4">
                    {notificationPermission === 'granted' ? (
                      <ToggleRow
                        icon={<Bell className="w-5 h-5" />}
                        label="Push Notifications"
                        description="Receive browser push notifications"
                        checked={preferences.notifications}
                        onChange={(v) => updatePreference('notifications', v)}
                      />
                    ) : (
                      <div className="flex items-center justify-between p-4 bg-[var(--surface)]/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-[var(--text-muted)]" />
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">Push Notifications</p>
                            <p className="text-xs text-[var(--text-muted)]">Permission required</p>
                          </div>
                        </div>
                        <button
                          onClick={requestNotificationPermission}
                          className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-black rounded-lg text-sm font-medium transition-colors"
                        >
                          Enable
                        </button>
                      </div>
                    )}

                    <ToggleRow
                      icon={preferences.soundEffects ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      label="Alert Sounds"
                      description="Play sounds for notifications"
                      checked={preferences.soundEffects}
                      onChange={(v) => updatePreference('soundEffects', v)}
                    />

                    <ToggleRow
                      icon={<Mail className="w-5 h-5" />}
                      label="Email Notifications"
                      description="Coming soon — receive email alerts"
                      checked={preferences.emailNotifications}
                      onChange={(v) => updatePreference('emailNotifications', v)}
                      disabled
                    />
                  </div>
                </SettingsCard>

                <SettingsCard title="Advanced Notifications" description="Fine-grained notification control">
                  <NotificationSettings className="mb-4" />
                  <PushNotifications />
                </SettingsCard>
              </div>
            )}

            {/* Data */}
            {activeSection === 'data' && (
              <div className="space-y-6 animate-fadeIn">
                <SettingsCard title="Export & Import" description="Back up or restore your data">
                  <div className="space-y-3">
                    <button
                      onClick={exportAllData}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--surface)]/50 hover:bg-[var(--surface)] border border-[var(--surface-border)] transition-colors group"
                    >
                      <Download className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--brand)] transition-colors" />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">Export All Data</p>
                        <p className="text-xs text-[var(--text-muted)]">Portfolio, watchlist, alerts, and settings as JSON</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--surface)]/50 hover:bg-[var(--surface)] border border-[var(--surface-border)] transition-colors group"
                    >
                      <Upload className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--brand)] transition-colors" />
                      <div className="text-left flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">Import Data</p>
                        <p className="text-xs text-[var(--text-muted)]">Restore from a previously exported JSON file</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={importData}
                      className="hidden"
                    />
                  </div>
                </SettingsCard>

                <SettingsCard title="Cache Management" description="Manage locally cached API data">
                  <button
                    onClick={clearApiCache}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-[var(--surface)]/50 hover:bg-[var(--surface)] border border-[var(--surface-border)] transition-colors group"
                  >
                    <RefreshCw className="w-5 h-5 text-[var(--text-muted)] group-hover:text-amber-400 transition-colors" />
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-[var(--text-primary)]">Clear API Cache</p>
                      <p className="text-xs text-[var(--text-muted)]">Force fresh data on next page load</p>
                    </div>
                  </button>
                </SettingsCard>

                <SettingsCard title="Danger Zone" description="Destructive actions that cannot be undone">
                  <button
                    onClick={clearAllData}
                    className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 transition-colors group"
                  >
                    <Trash2 className="w-5 h-5 text-red-400" />
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-red-400">Clear All Data</p>
                      <p className="text-xs text-red-400/70">Remove all local data including portfolio, watchlist, and settings</p>
                    </div>
                  </button>
                </SettingsCard>
              </div>
            )}

            {/* API Configuration */}
            {activeSection === 'api' && (
              <div className="space-y-6 animate-fadeIn">
                <SettingsCard title="Backend API" description="Configure connection to the crypto-vision backend">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Backend API URL</label>
                      <input
                        type="url"
                        value={preferences.apiUrl}
                        onChange={(e) => updatePreference('apiUrl', e.target.value)}
                        className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--brand)] placeholder-[var(--text-muted)]"
                        placeholder="http://localhost:8080"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Swarm API URL</label>
                      <input
                        type="url"
                        value={preferences.swarmApiUrl}
                        onChange={(e) => updatePreference('swarmApiUrl', e.target.value)}
                        className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--brand)] placeholder-[var(--text-muted)]"
                        placeholder="http://localhost:3847"
                      />
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard title="CoinGecko API" description="Optional API key for higher rate limits">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">API Key</label>
                    <input
                      type="password"
                      value={preferences.coingeckoApiKey}
                      onChange={(e) => updatePreference('coingeckoApiKey', e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--surface)] border border-[var(--surface-border)] rounded-xl text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--brand)] placeholder-[var(--text-muted)]"
                      placeholder="CG-xxxxxxxx"
                    />
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">
                      Get a free key at{' '}
                      <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline">
                        coingecko.com/api
                      </a>
                    </p>
                  </div>
                </SettingsCard>

                <SettingsCard title="Auto-Refresh" description="How often to refresh market data">
                  <div className="grid grid-cols-5 gap-2">
                    {REFRESH_INTERVALS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => updatePreference('refreshInterval', value)}
                        className={`p-3 rounded-xl border-2 transition-all text-center ${
                          preferences.refreshInterval === value
                            ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                            : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--surface-hover)]'
                        }`}
                      >
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* Keyboard Shortcuts */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-6 animate-fadeIn">
                {KEYBOARD_SHORTCUTS.map((section) => (
                  <SettingsCard key={section.category} title={section.category}>
                    <div className="space-y-2">
                      {section.items.map((shortcut) => (
                        <div key={shortcut.description} className="flex items-center justify-between py-2">
                          <span className="text-sm text-[var(--text-secondary)]">{shortcut.description}</span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <kbd className="px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--surface)] rounded border border-[var(--surface-border)] font-mono">
                                  {key}
                                </kbd>
                                {i < shortcut.keys.length - 1 && (
                                  <span className="text-[var(--text-muted)] text-xs">+</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SettingsCard>
                ))}
              </div>
            )}

            {/* About */}
            {activeSection === 'about' && (
              <div className="space-y-6 animate-fadeIn">
                <SettingsCard title="About Crypto Vision">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--brand)]/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-6 h-6 text-[var(--brand)]" />
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-secondary)] mb-2">
                        Crypto Vision is an open-source cryptocurrency data aggregator and market intelligence platform.
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        All data is stored locally in your browser. No account required for core features.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 text-xs font-medium bg-[var(--surface)] rounded-md text-[var(--text-muted)] border border-[var(--surface-border)]">
                          v2.0.0
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-[var(--surface)] rounded-md text-[var(--text-muted)] border border-[var(--surface-border)]">
                          Next.js 15
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-[var(--surface)] rounded-md text-[var(--text-muted)] border border-[var(--surface-border)]">
                          Dark Mode Only
                        </span>
                      </div>
                    </div>
                  </div>
                </SettingsCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--surface-border)] p-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">{title}</h2>
      {description && <p className="text-sm text-[var(--text-muted)] mb-4">{description}</p>}
      {!description && <div className="mb-4" />}
      {children}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
          <p className="text-xs text-[var(--text-muted)]">{description}</p>
        </div>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-[var(--brand)]' : 'bg-[var(--surface-hover)]'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        role="switch"
        aria-checked={checked}
        aria-label={label}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
