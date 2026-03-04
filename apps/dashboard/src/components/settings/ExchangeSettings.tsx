/**
 * Exchange Settings Component
 * 
 * UI for connecting and managing exchange integrations
 */

'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2,
  Link2Off,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  Shield,
  Wallet,
  Clock,
  Info,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { useExchangeSync, type ExchangeConfig } from '@/hooks/useExchangeSync';
import { cn } from '@/lib/utils';

// Exchange logos (inline for bundle optimization)
const ExchangeLogos: Record<string, React.ReactNode> = {
  binance: (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <path fill="#F3BA2F" d="M16 0L19.91 3.91L10.545 13.275L6.635 9.365L16 0ZM22.545 6.545L26.455 10.455L10.545 26.365L6.635 22.455L22.545 6.545ZM3.91 9.365L7.82 13.275L3.91 17.185L0 13.275L3.91 9.365ZM28.09 9.365L32 13.275L16 29.275L12.09 25.365L28.09 9.365Z"/>
    </svg>
  ),
  coinbase: (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle fill="#0052FF" cx="16" cy="16" r="16"/>
      <path fill="#fff" d="M16 6c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm0 15a5 5 0 110-10 5 5 0 010 10z"/>
    </svg>
  ),
  kraken: (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <circle fill="#5741D9" cx="16" cy="16" r="16"/>
      <path fill="#fff" d="M16 8l-6 4v8l6 4 6-4v-8l-6-4zm4 10.5l-4 2.67-4-2.67v-5l4-2.67 4 2.67v5z"/>
    </svg>
  ),
  okx: (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <rect fill="#121212" width="32" height="32" rx="8"/>
      <path fill="#fff" d="M12 12h8v8h-8z"/>
      <path fill="#fff" d="M8 8h4v4H8zM20 8h4v4h-4zM8 20h4v4H8zM20 20h4v4h-4z"/>
    </svg>
  ),
  bybit: (
    <svg viewBox="0 0 32 32" className="w-6 h-6">
      <rect fill="#F7A600" width="32" height="32" rx="8"/>
      <path fill="#121212" d="M8 10h6v12H8zM18 10h6v6h-6zM18 18h4v4h-4z"/>
    </svg>
  ),
};

const ExchangeDocsUrls: Record<string, string> = {
  binance: 'https://www.binance.com/en/support/faq/api-key',
  coinbase: 'https://help.coinbase.com/en/exchange/managing-my-account/how-to-create-an-api-key',
  kraken: 'https://support.kraken.com/hc/en-us/articles/360000919966',
  okx: 'https://www.okx.com/docs-v5/en/',
  bybit: 'https://www.bybit.com/future-activity/en-US/developer',
};

export function ExchangeSettings() {
  const {
    exchanges,
    connectedExchanges,
    portfolio,
    isLoading,
    isSyncing,
    error,
    connectExchange,
    disconnectExchange,
    syncExchange,
    syncAllExchanges,
  } = useExchangeSync();

  const [expandedExchange, setExpandedExchange] = useState<string | null>(null);
  const [connectingExchange, setConnectingExchange] = useState<string | null>(null);

  // Handle sync all
  const handleSyncAll = useCallback(async () => {
    await syncAllExchanges();
  }, [syncAllExchanges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Connected Exchanges</h2>
          <p className="text-sm text-text-secondary mt-1">
            Sync your portfolio from major exchanges
          </p>
        </div>
        
        {connectedExchanges.length > 0 && (
          <button
            onClick={handleSyncAll}
            disabled={isSyncing !== null}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-blue-500 hover:bg-blue-600 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors duration-200'
            )}
          >
            {isSyncing === 'all' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>Sync All</span>
          </button>
        )}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portfolio summary */}
      {portfolio && (
        <div className="bg-surface/50 border border-surface-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-400" />
              Total Portfolio Value
            </h3>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Clock className="w-3 h-3" />
              Last synced: {new Date(portfolio.lastUpdated).toLocaleTimeString()}
            </div>
          </div>
          
          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-bold text-white">
              ${portfolio.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={cn(
              'text-sm font-medium',
              portfolio.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {portfolio.changePercent >= 0 ? '+' : ''}{portfolio.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Exchange list */}
      <div className="space-y-3">
        {exchanges.map((exchange) => (
          <ExchangeCard
            key={exchange.id}
            exchange={exchange}
            isExpanded={expandedExchange === exchange.id}
            isConnecting={connectingExchange === exchange.id}
            isSyncing={isSyncing === exchange.id}
            onToggle={() => setExpandedExchange(
              expandedExchange === exchange.id ? null : exchange.id
            )}
            onConnect={async (credentials) => {
              setConnectingExchange(exchange.id);
              const result = await connectExchange(exchange.id, credentials);
              setConnectingExchange(null);
              if (result.success) {
                setExpandedExchange(null);
              }
              return result;
            }}
            onDisconnect={() => disconnectExchange(exchange.id)}
            onSync={() => syncExchange(exchange.id)}
          />
        ))}
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-400 font-medium">Security Notice</p>
          <p className="text-xs text-blue-400/70 mt-1">
            Your API credentials are encrypted with AES-256-GCM before storage. 
            We only request read-only permissions and never have access to withdraw funds.
          </p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EXCHANGE CARD COMPONENT
// =============================================================================

interface ExchangeCardProps {
  exchange: ExchangeConfig;
  isExpanded: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  onToggle: () => void;
  onConnect: (credentials: {
    apiKey: string;
    apiSecret: string;
    passphrase?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onDisconnect: () => void;
  onSync: () => void;
}

function ExchangeCard({
  exchange,
  isExpanded,
  isConnecting,
  isSyncing,
  onToggle,
  onConnect,
  onDisconnect,
  onSync,
}: ExchangeCardProps) {
  const [showForm, setShowForm] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const needsPassphrase = ['kraken', 'okx'].includes(exchange.id);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const result = await onConnect({
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      passphrase: needsPassphrase ? passphrase.trim() : undefined,
    });

    if (!result.success) {
      setLocalError(result.error || 'Connection failed');
    } else {
      setApiKey('');
      setApiSecret('');
      setPassphrase('');
      setShowForm(false);
    }
  };

  return (
    <div className={cn(
      'bg-surface/50 border rounded-xl overflow-hidden transition-colors duration-200',
      exchange.connected ? 'border-green-500/30' : 'border-surface-border',
      isExpanded && 'border-blue-500/50'
    )}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-surface-border/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {ExchangeLogos[exchange.id] || (
            <div className="w-6 h-6 bg-surface-hover rounded" />
          )}
          <div className="text-left">
            <h3 className="font-medium text-white">{exchange.name}</h3>
            {exchange.connected && exchange.lastSync && (
              <p className="text-xs text-text-secondary">
                Last sync: {new Date(exchange.lastSync).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {exchange.connected ? (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-surface-border text-text-secondary text-xs font-medium rounded-full">
              Not connected
            </span>
          )}
          <ChevronDown className={cn(
            'w-4 h-4 text-text-secondary transition-transform duration-200',
            isExpanded && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 border-t border-surface-border/50">
              {exchange.connected ? (
                /* Connected state - show actions */
                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={onSync}
                      disabled={isSyncing}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg',
                        'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors duration-200'
                      )}
                    >
                      {isSyncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Sync Now</span>
                    </button>
                    
                    <button
                      onClick={onDisconnect}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg',
                        'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                        'transition-colors duration-200'
                      )}
                    >
                      <Link2Off className="w-4 h-4" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              ) : showForm ? (
                /* Connection form */
                <form onSubmit={handleConnect} className="pt-4 space-y-4">
                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      API Key
                    </label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your API key"
                      required
                      className={cn(
                        'w-full px-3 py-2 bg-background-secondary/50 border border-surface-border rounded-lg',
                        'text-white placeholder-text-muted',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500'
                      )}
                    />
                  </div>

                  {/* API Secret */}
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                      API Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? 'text' : 'password'}
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        placeholder="Enter your API secret"
                        required
                        className={cn(
                          'w-full px-3 py-2 pr-10 bg-background-secondary/50 border border-surface-border rounded-lg',
                          'text-white placeholder-text-muted',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                      >
                        {showSecret ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Passphrase (for Kraken, OKX) */}
                  {needsPassphrase && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        API Passphrase
                      </label>
                      <input
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Enter your API passphrase"
                        required
                        className={cn(
                          'w-full px-3 py-2 bg-background-secondary/50 border border-surface-border rounded-lg',
                          'text-white placeholder-text-muted',
                          'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500'
                        )}
                      />
                    </div>
                  )}

                  {/* Local error */}
                  {localError && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span className="text-sm text-red-400">{localError}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isConnecting}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-lg',
                        'bg-green-500 hover:bg-green-600 text-white',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors duration-200'
                      )}
                    >
                      {isConnecting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      <span>Connect</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="px-4 py-2 text-text-secondary hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Help link */}
                  <a
                    href={ExchangeDocsUrls[exchange.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                  >
                    <Info className="w-3 h-3" />
                    How to create API keys on {exchange.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </form>
              ) : (
                /* Not connected - show connect button */
                <div className="pt-4">
                  <button
                    onClick={() => setShowForm(true)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg',
                      'bg-blue-500 hover:bg-blue-600 text-white',
                      'transition-colors duration-200'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Connect {exchange.name}</span>
                  </button>
                  
                  <p className="mt-3 text-xs text-text-muted">
                    Connect your {exchange.name} account to automatically sync your portfolio.
                    We only request read-only permissions.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExchangeSettings;
