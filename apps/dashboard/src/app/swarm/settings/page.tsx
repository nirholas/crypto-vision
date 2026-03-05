'use client';

import React, { useState, useCallback } from 'react';
import {
  Settings,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Shield,
  Globe,
  Zap,
  Bot,
  BarChart3,
  Clock,
} from 'lucide-react';
import { useSwarmConfig, useSwarmHealth } from '@/hooks/useSwarmData';
import { formatSol } from '@/types/swarm';

/* ─── Page ───────────────────────────────────────────────────── */

export default function SwarmSettingsPage() {
  const { config, health, error, isLoading, updateConfig, refetch } = useSwarmConfigAndHealth();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [apiUrl, setApiUrl] = useState(
    typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_SWARM_API_URL ?? 'http://localhost:3847')
      : 'http://localhost:3847',
  );

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await updateConfig(localConfig);
      setSaveSuccess(true);
      setLocalConfig({});
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(localConfig).length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Connection Settings */}
      <SettingsSection
        title="Connection"
        icon={<Globe size={16} />}
        description="Configure how the dashboard connects to the pump-agent-swarm backend."
      >
        <SettingsField
          label="Swarm API URL"
          hint="The URL of the pump-agent-swarm dashboard server. Set NEXT_PUBLIC_SWARM_API_URL to persist."
          value={apiUrl}
          onChange={setApiUrl}
          placeholder="http://localhost:3847"
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[var(--text-muted)]">Status:</span>
          {health ? (
            <span className="flex items-center gap-1 text-[var(--gain)]">
              <CheckCircle2 size={12} />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[var(--loss)]">
              <AlertTriangle size={12} />
              Disconnected
            </span>
          )}
        </div>
      </SettingsSection>

      {/* Trading Configuration */}
      {config && (
        <SettingsSection
          title="Trading Strategy"
          icon={<BarChart3 size={16} />}
          description="Live trading parameters. Changes take effect immediately."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SettingsField
              label="Min Trade Interval (sec)"
              value={localConfig.minIntervalSeconds ?? `${config.strategy.minIntervalSeconds}`}
              onChange={(v) => setLocalConfig((prev) => ({ ...prev, minIntervalSeconds: v }))}
              type="number"
            />
            <SettingsField
              label="Max Trade Interval (sec)"
              value={localConfig.maxIntervalSeconds ?? `${config.strategy.maxIntervalSeconds}`}
              onChange={(v) => setLocalConfig((prev) => ({ ...prev, maxIntervalSeconds: v }))}
              type="number"
            />
            <SettingsField
              label="Min Trade Size (SOL)"
              value={localConfig.minTradeSizeSol ?? `${config.strategy.minTradeSizeSol}`}
              onChange={(v) => setLocalConfig((prev) => ({ ...prev, minTradeSizeSol: v }))}
              type="number"
            />
            <SettingsField
              label="Max Trade Size (SOL)"
              value={localConfig.maxTradeSizeSol ?? `${config.strategy.maxTradeSizeSol}`}
              onChange={(v) => setLocalConfig((prev) => ({ ...prev, maxTradeSizeSol: v }))}
              type="number"
            />
            <SettingsField
              label="Buy/Sell Ratio"
              hint="Values > 1 = more buys. Values < 1 = more sells."
              value={localConfig.buySellRatio ?? `${config.strategy.buySellRatio}`}
              onChange={(v) => setLocalConfig((prev) => ({ ...prev, buySellRatio: v }))}
              type="number"
            />
            <SettingsField
              label="Max Total Budget (SOL)"
              value={localConfig.maxTotalBudgetSol ?? `${config.strategy.maxTotalBudgetSol}`}
              onChange={(v) => setLocalConfig((prev) => ({ ...prev, maxTotalBudgetSol: v }))}
              type="number"
            />
            <SettingsField
              label="Priority Fee (µ-lamports)"
              value={localConfig.priorityFeeMicroLamports ?? `${config.strategy.priorityFeeMicroLamports}`}
              onChange={(v) => setLocalConfig((prev) => ({ ...prev, priorityFeeMicroLamports: v }))}
              type="number"
            />
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Jito Bundles</label>
              <button
                onClick={() => {
                  const current = localConfig.useJitoBundles ?? `${config.strategy.useJitoBundles}`;
                  setLocalConfig((prev) => ({
                    ...prev,
                    useJitoBundles: current === 'true' ? 'false' : 'true',
                  }));
                }}
                className={`relative w-10 h-5 rounded-full transition-all ${
                  (localConfig.useJitoBundles ?? `${config.strategy.useJitoBundles}`) === 'true'
                    ? 'bg-[var(--brand)]'
                    : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    (localConfig.useJitoBundles ?? `${config.strategy.useJitoBundles}`) === 'true'
                      ? 'translate-x-5'
                      : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* System Settings */}
      {config && (
        <SettingsSection
          title="System"
          icon={<Settings size={16} />}
          description="General swarm configuration."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SettingsField label="Trader Count" value={`${config.traderCount}`} disabled />
            <SettingsField label="Network" value={config.network} disabled />
            <SettingsField label="RPC URL" value={config.rpcUrl} disabled />
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Log Level</label>
              <select
                value={localConfig.logLevel ?? config.logLevel}
                onChange={(e) => setLocalConfig((prev) => ({ ...prev, logLevel: e.target.value }))}
                className="bg-[var(--bg-primary)] border border-[var(--surface-border)] rounded-md px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* Health Report */}
      {health && (
        <SettingsSection
          title="Health Report"
          icon={<Shield size={16} />}
          description="Current system health status."
        >
          <div className="space-y-2">
            {health.checks.map((check, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">{check.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">{check.message}</span>
                  {check.status === 'pass' ? (
                    <CheckCircle2 size={14} className="text-[var(--gain)]" />
                  ) : check.status === 'warn' ? (
                    <AlertTriangle size={14} className="text-yellow-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-[var(--loss)]" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--surface-border)] grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[var(--text-muted)]">RPC Latency</span>
              <div className="text-sm font-mono text-[var(--text-primary)]">{health.metrics.rpcLatency}ms</div>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Event Bus Backlog</span>
              <div className="text-sm font-mono text-[var(--text-primary)]">{health.metrics.eventBusBacklog}</div>
            </div>
            {health.metrics.cpuUsage !== undefined && (
              <div>
                <span className="text-[var(--text-muted)]">CPU</span>
                <div className="text-sm font-mono text-[var(--text-primary)]">{health.metrics.cpuUsage.toFixed(1)}%</div>
              </div>
            )}
            {health.metrics.memoryUsage !== undefined && (
              <div>
                <span className="text-[var(--text-muted)]">Memory</span>
                <div className="text-sm font-mono text-[var(--text-primary)]">{(health.metrics.memoryUsage / 1024 / 1024).toFixed(0)} MB</div>
              </div>
            )}
          </div>
        </SettingsSection>
      )}

      {/* Save Bar */}
      {(hasChanges || saveSuccess || saveError) && (
        <div className="sticky bottom-4 flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)] shadow-lg">
          <div className="text-sm">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-[var(--gain)]">
                <CheckCircle2 size={14} />
                Settings saved
              </span>
            )}
            {saveError && (
              <span className="flex items-center gap-1.5 text-[var(--loss)]">
                <AlertTriangle size={14} />
                {saveError}
              </span>
            )}
            {!saveSuccess && !saveError && hasChanges && (
              <span className="text-[var(--text-secondary)]">
                {Object.keys(localConfig).length} unsaved change{Object.keys(localConfig).length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <button
                  onClick={() => setLocalConfig({})}
                  className="px-3 py-1.5 rounded-md text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[var(--brand)] text-[var(--bg-primary)] text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Combined Hook ──────────────────────────────────────────── */

function useSwarmConfigAndHealth() {
  const configHook = useSwarmConfig();
  const healthHook = useSwarmHealth();

  return {
    config: configHook.config,
    health: healthHook.health,
    error: configHook.error ?? healthHook.error,
    isLoading: configHook.isLoading || healthHook.isLoading,
    updateConfig: configHook.updateConfig,
    refetch: configHook.refetch,
  };
}

/* ─── Settings Section ───────────────────────────────────────── */

function SettingsSection({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[var(--text-muted)]">{icon}</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="p-5 space-y-4">
        {children}
      </div>
    </section>
  );
}

/* ─── Settings Field ─────────────────────────────────────────── */

function SettingsField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-[var(--text-secondary)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full bg-[var(--bg-primary)] border border-[var(--surface-border)] rounded-md px-3 py-1.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-[var(--brand)] ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      />
      {hint && <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
