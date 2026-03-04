'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  Search,
  X,
  TrendingUp,
  BarChart3,
  Wallet,
  ArrowRight,
  Command,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface SearchResult {
  id: string;
  label: string;
  category: string;
  href: string;
  icon?: React.ReactNode;
}

export interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

/* ─── Quick Actions ──────────────────────────────────────────────────── */

const QUICK_ACTIONS: SearchResult[] = [
  { id: 'markets', label: 'Markets Overview', category: 'Navigation', href: '/', icon: <BarChart3 size={16} /> },
  { id: 'trending', label: 'Trending Coins', category: 'Navigation', href: '/trending', icon: <TrendingUp size={16} /> },
  { id: 'portfolio', label: 'Portfolio', category: 'Navigation', href: '/portfolio', icon: <Wallet size={16} /> },
  { id: 'btc', label: 'Bitcoin (BTC)', category: 'Coin', href: '/coin/bitcoin', icon: <span className="text-[var(--warning)]">₿</span> },
  { id: 'eth', label: 'Ethereum (ETH)', category: 'Coin', href: '/coin/ethereum', icon: <span className="text-[var(--secondary)]">Ξ</span> },
  { id: 'sol', label: 'Solana (SOL)', category: 'Coin', href: '/coin/solana', icon: <span className="text-[var(--primary)]">◎</span> },
  { id: 'heatmap', label: 'Market Heatmap', category: 'Tool', href: '/heatmap', icon: <BarChart3 size={16} /> },
  { id: 'screener', label: 'Screener', category: 'Tool', href: '/screener', icon: <BarChart3 size={16} /> },
];

/* ─── Component ──────────────────────────────────────────────────────── */

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? QUICK_ACTIONS.filter(
        (r) =>
          r.label.toLowerCase().includes(query.toLowerCase()) ||
          r.category.toLowerCase().includes(query.toLowerCase()),
      )
    : QUICK_ACTIONS;

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        window.location.href = filtered[selectedIndex].href;
        onClose();
      }
    },
    [filtered, selectedIndex, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="
          relative w-full max-w-lg mx-4
          bg-[var(--bg-secondary)] border border-[var(--surface-border)]
          rounded-xl shadow-elevated overflow-hidden
          animate-scale-in
        "
        role="dialog"
        aria-modal="true"
        aria-label="Quick search"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-[var(--surface-border)]">
          <Search size={16} className="text-[var(--text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search markets, coins, tools..."
            className="
              flex-1 bg-transparent text-sm text-[var(--text-primary)]
              placeholder:text-[var(--text-muted)] outline-none
            "
            aria-label="Search"
          />
          <button
            onClick={onClose}
            className="topbar-action-btn flex-shrink-0"
            aria-label="Close search"
          >
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul role="listbox" aria-label="Search results">
              {filtered.map((result, idx) => (
                <li key={result.id} role="option" aria-selected={idx === selectedIndex}>
                  <a
                    href={result.href}
                    className={`
                      flex items-center gap-3 px-4 py-2.5 text-sm
                      transition-colors duration-100
                      ${idx === selectedIndex
                        ? 'bg-[var(--surface-hover)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
                      }
                    `}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={onClose}
                  >
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-[var(--text-muted)]">
                      {result.icon}
                    </span>
                    <span className="flex-1 truncate">{result.label}</span>
                    <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                      {result.category}
                    </span>
                    {idx === selectedIndex && (
                      <ArrowRight size={12} className="text-[var(--primary)]" />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--surface-border)] text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface)] font-mono">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface)] font-mono">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface)] font-mono">esc</kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
