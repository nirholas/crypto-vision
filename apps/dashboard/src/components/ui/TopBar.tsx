'use client';

import { useCallback, useState } from 'react';
import {
  Search,
  Bell,
  Settings,
  Wifi,
  WifiOff,
  Wallet,
  Command,
} from 'lucide-react';
import { StatusDot } from './StatusDot';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface TopBarProps {
  onSearchOpen?: () => void;
  sidebarCollapsed?: boolean;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function TopBar({ onSearchOpen, sidebarCollapsed = false }: TopBarProps) {
  const [networkOnline, setNetworkOnline] = useState(true);

  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setNetworkOnline(true));
    window.addEventListener('offline', () => setNetworkOnline(false));
  }

  const handleSearchClick = useCallback(() => {
    if (onSearchOpen) {
      onSearchOpen();
    } else {
      // Dispatch Cmd+K event to trigger the existing GlobalSearch
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true,
      });
      document.dispatchEvent(event);
    }
  }, [onSearchOpen]);

  const sidebarOffset = sidebarCollapsed ? 'left-16' : 'left-60';

  return (
    <header
      className={`
        fixed top-0 right-0 z-30
        ${sidebarOffset}
        h-12 flex items-center justify-between
        bg-[var(--bg-primary)]/80 backdrop-blur-md
        border-b border-[var(--surface-border)]
        px-4 transition-[left] duration-200 ease-out
        md:${sidebarOffset}
        max-md:left-0
      `}
      role="banner"
    >
      {/* Left: Search */}
      <button
        onClick={handleSearchClick}
        className="
          flex items-center gap-2 h-8 px-3 rounded-lg
          bg-[var(--surface)] border border-[var(--surface-border)]
          text-[var(--text-muted)] text-xs
          hover:border-[var(--primary)]/30 hover:text-[var(--text-secondary)]
          transition-all duration-150 min-w-[200px] max-w-[320px]
        "
        aria-label="Open search (Cmd+K)"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search markets, coins...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded font-mono">
          <Command size={10} />K
        </kbd>
      </button>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Network Status */}
        <div className="topbar-action-btn" title={networkOnline ? 'Connected' : 'Offline'}>
          {networkOnline ? (
            <div className="flex items-center gap-1.5">
              <StatusDot status="connected" size="sm" />
              <Wifi size={14} className="text-[var(--text-muted)]" />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <StatusDot status="error" size="sm" />
              <WifiOff size={14} className="text-[var(--loss)]" />
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <button
          className="topbar-action-btn relative"
          aria-label="Notifications"
        >
          <Bell size={16} />
          {/* Notification indicator dot */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--loss)] rounded-full" />
        </button>

        {/* Wallet Connect (placeholder) */}
        <button
          className="
            flex items-center gap-1.5 h-8 px-3 rounded-lg
            bg-[var(--surface)] border border-[var(--surface-border)]
            text-[var(--text-secondary)] text-xs font-medium
            hover:border-[var(--primary)]/30 hover:text-[var(--text-primary)]
            transition-all duration-150
          "
          aria-label="Connect wallet"
        >
          <Wallet size={14} />
          <span className="hidden sm:inline">Connect</span>
        </button>

        {/* Settings */}
        <button
          className="topbar-action-btn"
          aria-label="Settings"
          onClick={() => {
            // Navigate to settings
            window.location.href = '/settings';
          }}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

export default TopBar;
