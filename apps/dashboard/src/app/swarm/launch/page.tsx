'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Rocket,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Info,
  Wallet,
  Zap,
  Bot,
  Shield,
} from 'lucide-react';
import type { TokenConfig, PresetStrategyId } from '@/types/swarm';
import { PRESET_STRATEGIES, formatSol } from '@/types/swarm';

/* ─── Types ──────────────────────────────────────────────────── */

interface LaunchConfig {
  token: TokenConfig;
  strategy: PresetStrategyId;
  network: 'mainnet-beta' | 'devnet';
  traderCount: number;
  rpcUrl: string;
  jitoTipLamports: number;
  masterWalletKey: string;
  devBuySol: number;
}

type Step = 'token' | 'strategy' | 'wallets' | 'review';

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'token', label: 'Token', icon: <Zap size={16} /> },
  { id: 'strategy', label: 'Strategy', icon: <Bot size={16} /> },
  { id: 'wallets', label: 'Wallets', icon: <Wallet size={16} /> },
  { id: 'review', label: 'Review', icon: <Shield size={16} /> },
];

/* ─── Budget Estimation ──────────────────────────────────────── */

const STRATEGY_BUDGETS: Record<PresetStrategyId, number> = {
  organic: 2,
  volume: 5,
  graduation: 10,
  exit: 3,
};

function estimateBudget(strategy: PresetStrategyId, traderCount: number, devBuySol: number): number {
  return STRATEGY_BUDGETS[strategy] * traderCount + devBuySol + 0.5; // +0.5 for fees
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function SwarmLaunchPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('token');
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<LaunchConfig>({
    token: { name: '', symbol: '', metadataUri: '' },
    strategy: 'organic',
    network: 'devnet',
    traderCount: 5,
    rpcUrl: '',
    jitoTipLamports: 10_000,
    masterWalletKey: '',
    devBuySol: 0.5,
  });

  const updateToken = useCallback((updates: Partial<TokenConfig>) => {
    setConfig((prev) => ({ ...prev, token: { ...prev.token, ...updates } }));
  }, []);

  const updateConfig = useCallback((updates: Partial<LaunchConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const canNext = stepIndex < STEPS.length - 1;
  const canBack = stepIndex > 0;

  const isTokenValid =
    config.token.name.trim().length > 0 &&
    config.token.symbol.trim().length > 0 &&
    config.token.metadataUri.trim().length > 0;

  const isWalletValid = config.masterWalletKey.trim().length > 0;

  const canProceed =
    (step === 'token' && isTokenValid) ||
    (step === 'strategy') ||
    (step === 'wallets' && isWalletValid) ||
    step === 'review';

  const estimatedBudget = estimateBudget(config.strategy, config.traderCount, config.devBuySol);

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    try {
      const response = await fetch('/api/swarm/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Launch failed' }));
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }

      setLaunched(true);
      setTimeout(() => router.push('/swarm'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setLaunching(false);
    }
  };

  if (launched) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-full bg-[var(--gain)]/15 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-[var(--gain)]" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Swarm Launched!</h2>
        <p className="text-sm text-[var(--text-muted)]">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => setStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                step === s.id
                  ? 'bg-[var(--brand)]/15 text-[var(--brand)]'
                  : i < stepIndex
                    ? 'text-[var(--gain)] bg-[var(--gain)]/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {i < stepIndex ? <CheckCircle2 size={14} /> : s.icon}
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="text-[var(--text-muted)]" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-6">
        {step === 'token' && (
          <TokenStep token={config.token} onUpdate={updateToken} devBuySol={config.devBuySol} onDevBuyChange={(v) => updateConfig({ devBuySol: v })} />
        )}
        {step === 'strategy' && (
          <StrategyStep
            selected={config.strategy}
            onSelect={(s) => updateConfig({ strategy: s })}
            traderCount={config.traderCount}
            onTraderCountChange={(n) => updateConfig({ traderCount: n })}
          />
        )}
        {step === 'wallets' && (
          <WalletStep
            config={config}
            onUpdate={updateConfig}
            estimatedBudget={estimatedBudget}
          />
        )}
        {step === 'review' && (
          <ReviewStep config={config} estimatedBudget={estimatedBudget} />
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[var(--loss)]/10 border border-[var(--loss)]/30 text-sm text-[var(--loss)]">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(STEPS[stepIndex - 1].id)}
          disabled={!canBack}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--surface-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft size={16} />
          Back
        </button>

        {step === 'review' ? (
          <button
            onClick={handleLaunch}
            disabled={launching || !isWalletValid}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--brand)] text-[var(--bg-primary)] font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {launching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Rocket size={16} />
                Launch Swarm
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => setStep(STEPS[stepIndex + 1].id)}
            disabled={!canProceed}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--brand)]/15 text-[var(--brand)] text-sm font-medium hover:bg-[var(--brand)]/25 transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            Next
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Step 1: Token Configuration ────────────────────────────── */

function TokenStep({
  token,
  onUpdate,
  devBuySol,
  onDevBuyChange,
}: {
  token: TokenConfig;
  onUpdate: (updates: Partial<TokenConfig>) => void;
  devBuySol: number;
  onDevBuyChange: (v: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Token Details</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Configure your Pump.fun token. Metadata URI should point to a JSON file with name, symbol, description, and image.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Token Name" required>
          <input
            type="text"
            placeholder="e.g. Agent Intelligence Coin"
            value={token.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="form-input"
          />
        </FormField>
        <FormField label="Symbol" required>
          <input
            type="text"
            placeholder="e.g. AICOIN"
            value={token.symbol}
            onChange={(e) => onUpdate({ symbol: e.target.value.toUpperCase() })}
            maxLength={10}
            className="form-input"
          />
        </FormField>
      </div>

      <FormField label="Metadata URI" required hint="IPFS, Arweave, or any public URL pointing to token metadata JSON">
        <input
          type="url"
          placeholder="https://arweave.net/..."
          value={token.metadataUri}
          onChange={(e) => onUpdate({ metadataUri: e.target.value })}
          className="form-input"
        />
      </FormField>

      <FormField label="Vanity Prefix (optional)" hint="Attempt to generate a mint address starting with this prefix">
        <input
          type="text"
          placeholder="pump..."
          value={token.vanityPrefix ?? ''}
          onChange={(e) => onUpdate({ vanityPrefix: e.target.value || undefined })}
          className="form-input"
        />
      </FormField>

      <FormField label="Dev Buy Amount (SOL)" hint="Amount of SOL for the initial creator buy on the bonding curve">
        <input
          type="number"
          min={0}
          step={0.1}
          value={devBuySol}
          onChange={(e) => onDevBuyChange(Math.max(0, parseFloat(e.target.value) || 0))}
          className="form-input"
        />
      </FormField>
    </div>
  );
}

/* ─── Step 2: Strategy Selection ─────────────────────────────── */

function StrategyStep({
  selected,
  onSelect,
  traderCount,
  onTraderCountChange,
}: {
  selected: PresetStrategyId;
  onSelect: (s: PresetStrategyId) => void;
  traderCount: number;
  onTraderCountChange: (n: number) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Trading Strategy</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Choose how the agent swarm will trade on your token&apos;s bonding curve.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PRESET_STRATEGIES.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onSelect(preset.id)}
            className={`p-4 rounded-lg border-2 text-left transition-all ${
              selected === preset.id
                ? 'border-[var(--brand)] bg-[var(--brand)]/5'
                : 'border-[var(--surface-border)] hover:border-[var(--text-muted)]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-lg">{preset.icon}</span>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{preset.name}</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{preset.description}</p>
            <div className="mt-2 text-[10px] text-[var(--text-muted)]">
              ~{STRATEGY_BUDGETS[preset.id]} SOL per trader
            </div>
          </button>
        ))}
      </div>

      <FormField label="Number of Trader Agents" hint="More traders = more natural-looking activity, but higher budget">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={15}
            value={traderCount}
            onChange={(e) => onTraderCountChange(parseInt(e.target.value))}
            className="flex-1 accent-[var(--brand)]"
          />
          <span className="text-sm font-bold text-[var(--text-primary)] w-8 text-center tabular-nums">
            {traderCount}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
          <span>Stealthy (2)</span>
          <span>Aggressive (15)</span>
        </div>
      </FormField>

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--brand)]/5 border border-[var(--brand)]/20 text-xs text-[var(--text-secondary)]">
        <Info size={14} className="text-[var(--brand)] flex-shrink-0" />
        Estimated budget: <strong className="text-[var(--text-primary)]">{formatSol(estimateBudget(selected, traderCount, 0.5))}</strong> (excluding dev buy)
      </div>
    </div>
  );
}

/* ─── Step 3: Wallet Setup ───────────────────────────────────── */

function WalletStep({
  config,
  onUpdate,
  estimatedBudget,
}: {
  config: LaunchConfig;
  onUpdate: (updates: Partial<LaunchConfig>) => void;
  estimatedBudget: number;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Wallet & Network</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Provide a funded master wallet. The swarm will auto-distribute SOL to {config.traderCount} trader wallets and reclaim funds after completion.
        </p>
      </div>

      {/* Network */}
      <FormField label="Network">
        <div className="flex gap-3">
          {(['devnet', 'mainnet-beta'] as const).map((net) => (
            <button
              key={net}
              onClick={() => onUpdate({ network: net })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                config.network === net
                  ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand)]'
                  : 'border-[var(--surface-border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]'
              }`}
            >
              {net === 'devnet' ? '🧪 Devnet' : '🌐 Mainnet'}
            </button>
          ))}
        </div>
        {config.network === 'mainnet-beta' && (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[var(--loss)]/10 border border-[var(--loss)]/20 text-xs text-[var(--loss)]">
            <AlertTriangle size={14} />
            Mainnet uses real SOL. You need ~{formatSol(estimatedBudget)} in your master wallet.
          </div>
        )}
      </FormField>

      {/* Master Wallet Key */}
      <FormField
        label="Master Wallet Private Key"
        required
        hint="Base58-encoded Solana private key. This wallet must be pre-funded. Keys are never stored — they're only used in-memory during the session."
      >
        <input
          type="password"
          placeholder="Enter base58 private key..."
          value={config.masterWalletKey}
          onChange={(e) => onUpdate({ masterWalletKey: e.target.value })}
          className="form-input font-mono"
        />
      </FormField>

      {/* RPC URL */}
      <FormField label="RPC URL (optional)" hint="Custom Solana RPC. Defaults to public endpoints if empty.">
        <input
          type="url"
          placeholder={config.network === 'devnet' ? 'https://api.devnet.solana.com' : 'https://api.mainnet-beta.solana.com'}
          value={config.rpcUrl}
          onChange={(e) => onUpdate({ rpcUrl: e.target.value })}
          className="form-input font-mono"
        />
      </FormField>

      {/* Jito Tip */}
      <FormField label="Jito Bundle Tip (lamports)" hint="Tip for MEV-protected Jito bundle submission. Higher tips = faster inclusion.">
        <input
          type="number"
          min={0}
          value={config.jitoTipLamports}
          onChange={(e) => onUpdate({ jitoTipLamports: parseInt(e.target.value) || 0 })}
          className="form-input"
        />
      </FormField>

      {/* Budget Summary */}
      <div className="rounded-lg border border-[var(--surface-border)] p-4 space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Budget Breakdown</h4>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Dev Buy</span>
            <span className="font-mono text-[var(--text-primary)] tabular-nums">{formatSol(config.devBuySol)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">Trader Funding ({config.traderCount} × {STRATEGY_BUDGETS[config.strategy]} SOL)</span>
            <span className="font-mono text-[var(--text-primary)] tabular-nums">{formatSol(STRATEGY_BUDGETS[config.strategy] * config.traderCount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">TX Fees (est.)</span>
            <span className="font-mono text-[var(--text-primary)] tabular-nums">{formatSol(0.5)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-[var(--surface-border)]">
            <span className="text-[var(--text-primary)] font-semibold">Total Required</span>
            <span className="font-mono font-bold text-[var(--brand)] tabular-nums">{formatSol(estimatedBudget)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 4: Review ─────────────────────────────────────────── */

function ReviewStep({ config, estimatedBudget }: { config: LaunchConfig; estimatedBudget: number }) {
  const preset = PRESET_STRATEGIES.find((s) => s.id === config.strategy);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Review & Launch</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Double-check everything before deploying. This action will create a Pump.fun token and start autonomous trading.
        </p>
      </div>

      <div className="space-y-3">
        <ReviewRow label="Token" value={`${config.token.name} (${config.token.symbol})`} />
        <ReviewRow label="Metadata" value={config.token.metadataUri} mono />
        <ReviewRow label="Strategy" value={`${preset?.icon} ${preset?.name}`} />
        <ReviewRow label="Traders" value={`${config.traderCount} agents`} />
        <ReviewRow label="Network" value={config.network === 'devnet' ? '🧪 Devnet' : '🌐 Mainnet-Beta'} />
        <ReviewRow label="Dev Buy" value={formatSol(config.devBuySol)} />
        <ReviewRow label="Jito Tip" value={`${config.jitoTipLamports.toLocaleString()} lamports`} />
        <ReviewRow label="Total Budget" value={formatSol(estimatedBudget)} highlight />
        <ReviewRow label="Wallet" value={`${config.masterWalletKey.slice(0, 8)}...${config.masterWalletKey.slice(-4)}`} mono />
      </div>

      {config.network === 'mainnet-beta' && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Mainnet deployment</strong> — This will use real SOL. Ensure your master wallet has at least {formatSol(estimatedBudget)}.
            Funds will be automatically reclaimed after the swarm completes.
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shared Components ──────────────────────────────────────── */

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-[var(--text-secondary)]">
        {label}
        {required && <span className="text-[var(--loss)] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[var(--text-muted)]">{hint}</p>}

      <style jsx global>{`
        .form-input {
          width: 100%;
          background: var(--bg-primary);
          border: 1px solid var(--surface-border);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input::placeholder {
          color: var(--text-muted);
        }
        .form-input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 1px var(--brand);
        }
      `}</style>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[var(--surface-border)] last:border-0">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span
        className={`text-sm ${mono ? 'font-mono' : ''} ${
          highlight ? 'font-bold text-[var(--brand)]' : 'text-[var(--text-primary)]'
        } truncate max-w-[60%] text-right`}
      >
        {value}
      </span>
    </div>
  );
}
