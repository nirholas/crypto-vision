'use client';

import React, { useState } from 'react';
import type { TokenConfig, PresetStrategyId } from '@/types/swarm';
import { PRESET_STRATEGIES } from '@/types/swarm';

// ─── Props ────────────────────────────────────────────────────

interface SwarmLauncherProps {
  onLaunch: (config: LaunchConfig) => Promise<void>;
}

export interface LaunchConfig {
  token: TokenConfig;
  strategy: PresetStrategyId;
  network: 'mainnet-beta' | 'devnet';
  traderCount: number;
  rpcUrl: string;
  jitoTipLamports: number;
  masterWalletKey: string;
}

// ─── Component ────────────────────────────────────────────────

export function SwarmLauncher({ onLaunch }: SwarmLauncherProps) {
  const [token, setToken] = useState<TokenConfig>({
    name: '',
    symbol: '',
    metadataUri: '',
  });
  const [selectedStrategy, setSelectedStrategy] = useState<PresetStrategyId>('organic');
  const [network, setNetwork] = useState<'mainnet-beta' | 'devnet'>('devnet');
  const [traderCount, setTraderCount] = useState(5);
  const [rpcUrl, setRpcUrl] = useState('');
  const [jitoTipLamports, setJitoTipLamports] = useState(10000);
  const [masterWalletKey, setMasterWalletKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid =
    token.name.trim().length > 0 &&
    token.symbol.trim().length > 0 &&
    token.metadataUri.trim().length > 0;

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    try {
      await onLaunch({
        token,
        strategy: selectedStrategy,
        network,
        traderCount,
        rpcUrl,
        jitoTipLamports,
        masterWalletKey,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setLaunching(false);
      setShowConfirmation(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Token Configuration */}
      <section className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-200">Token Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Token Name"
            placeholder="AI Agent Coin"
            value={token.name}
            onChange={(v) => setToken((prev) => ({ ...prev, name: v }))}
          />
          <InputField
            label="Symbol"
            placeholder="AIAC"
            value={token.symbol}
            onChange={(v) => setToken((prev) => ({ ...prev, symbol: v.toUpperCase() }))}
            maxLength={10}
          />
        </div>
        <InputField
          label="Metadata URI"
          placeholder="https://arweave.net/..."
          value={token.metadataUri}
          onChange={(v) => setToken((prev) => ({ ...prev, metadataUri: v }))}
        />
        <InputField
          label="Vanity Prefix (optional)"
          placeholder="pump..."
          value={token.vanityPrefix ?? ''}
          onChange={(v) => setToken((prev) => ({ ...prev, vanityPrefix: v || undefined }))}
        />
      </section>

      {/* Strategy Selector */}
      <section className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-200">Trading Strategy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESET_STRATEGIES.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedStrategy(preset.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedStrategy === preset.id
                  ? 'border-indigo-500 bg-indigo-900/20'
                  : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{preset.icon}</span>
                <span className="font-semibold text-gray-200">{preset.name}</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">{preset.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Network Selector */}
      <section className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Network</h3>
        <div className="flex gap-3">
          {(['devnet', 'mainnet-beta'] as const).map((net) => (
            <button
              key={net}
              onClick={() => setNetwork(net)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                network === net
                  ? 'border-indigo-500 bg-indigo-900/20 text-indigo-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {net === 'devnet' ? '🧪 Devnet' : '🌐 Mainnet-Beta'}
            </button>
          ))}
        </div>
        {network === 'mainnet-beta' && (
          <p className="text-xs text-amber-400 mt-2">
            ⚠ Mainnet uses real SOL. Proceed with caution.
          </p>
        )}
      </section>

      {/* Advanced Config */}
      <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-800/70 transition-colors"
        >
          <h3 className="text-lg font-semibold text-gray-200">Advanced Configuration</h3>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAdvanced && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-700 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Trader Count</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={traderCount}
                  onChange={(e) => setTraderCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Jito Tip (lamports)</label>
                <input
                  type="number"
                  min={0}
                  value={jitoTipLamports}
                  onChange={(e) => setJitoTipLamports(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <InputField
              label="RPC URL"
              placeholder="https://api.devnet.solana.com"
              value={rpcUrl}
              onChange={setRpcUrl}
            />
            <InputField
              label="Master Wallet Private Key (base58)"
              placeholder="Enter private key..."
              value={masterWalletKey}
              onChange={setMasterWalletKey}
              type="password"
            />
          </div>
        )}
      </section>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Launch Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowConfirmation(true)}
          disabled={!isValid || launching}
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold text-white shadow-lg transition-all text-lg"
        >
          {launching ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Launching...
            </span>
          ) : (
            '🚀 Launch Swarm'
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md mx-4 space-y-4">
            <h3 className="text-xl font-bold text-gray-200">Confirm Launch</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <p>
                <strong className="text-gray-200">Token:</strong> {token.name} ({token.symbol})
              </p>
              <p>
                <strong className="text-gray-200">Strategy:</strong>{' '}
                {PRESET_STRATEGIES.find((s) => s.id === selectedStrategy)?.name}
              </p>
              <p>
                <strong className="text-gray-200">Network:</strong> {network}
              </p>
              <p>
                <strong className="text-gray-200">Traders:</strong> {traderCount}
              </p>
            </div>
            {network === 'mainnet-beta' && (
              <p className="text-amber-400 text-sm font-medium">
                ⚠ This will use real SOL on mainnet!
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {launching ? 'Launching...' : 'Confirm Launch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Input Field ──────────────────────────────────────────────

function InputField({
  label,
  placeholder,
  value,
  onChange,
  maxLength,
  type = 'text',
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
