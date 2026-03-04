'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  TrendingUp,
  ArrowUpDown,
  Grid3X3,
  SlidersHorizontal,
  Terminal,
  Bot,
  Package,
  Activity,
  Wallet,
  Eye,
  Bell,
  Brain,
  Landmark,
  Link2,
  MessageSquare,
  KeyRound,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Hexagon,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/* ─── Navigation Config ──────────────────────────────────────────────── */

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Markets',
    items: [
      { label: 'Overview', href: '/', icon: <BarChart3 size={18} /> },
      { label: 'Trending', href: '/trending', icon: <TrendingUp size={18} /> },
      { label: 'Gainers / Losers', href: '/movers', icon: <ArrowUpDown size={18} /> },
      { label: 'Heatmap', href: '/heatmap', icon: <Grid3X3 size={18} /> },
      { label: 'Screener', href: '/screener', icon: <SlidersHorizontal size={18} /> },
    ],
  },
  {
    title: 'Trading',
    items: [
      { label: 'Terminal', href: '/markets', icon: <Terminal size={18} /> },
      { label: 'Swarm Control', href: '/swarm', icon: <Bot size={18} /> },
      { label: 'Bundle Manager', href: '/defi', icon: <Package size={18} /> },
      { label: 'Market Maker', href: '/liquidations', icon: <Activity size={18} /> },
    ],
  },
  {
    title: 'Portfolio',
    items: [
      { label: 'Holdings', href: '/portfolio', icon: <Wallet size={18} /> },
      { label: 'Watchlist', href: '/watchlist', icon: <Eye size={18} /> },
      { label: 'Alerts', href: '/settings', icon: <Bell size={18} /> },
    ],
  },
  {
    title: 'Research',
    items: [
      { label: 'AI Analysis', href: '/sentiment', icon: <Brain size={18} /> },
      { label: 'DeFi', href: '/defi', icon: <Landmark size={18} /> },
      { label: 'On-Chain', href: '/correlation', icon: <Link2 size={18} /> },
      { label: 'Sentiment', href: '/buzz', icon: <MessageSquare size={18} /> },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'API Keys', href: '/admin', icon: <KeyRound size={18} /> },
      { label: 'Settings', href: '/settings', icon: <Settings size={18} /> },
      { label: 'Billing', href: '/pricing', icon: <CreditCard size={18} /> },
    ],
  },
];

/* ─── Props ──────────────────────────────────────────────────────────── */

export interface SidebarProps {
  defaultCollapsed?: boolean;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Sidebar({ defaultCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Detect mobile
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (e.matches) setCollapsed(true);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Keyboard shortcut: [ to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  }, [isMobile]);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/';
      return pathname.startsWith(href);
    },
    [pathname],
  );

  const sidebarWidth = collapsed ? 'w-16' : 'w-60';

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile toggle button */}
      {isMobile && !mobileOpen && (
        <button
          onClick={toggle}
          className="fixed top-2 left-2 z-50 topbar-action-btn bg-[var(--surface)] border border-[var(--surface-border)]"
          aria-label="Open navigation"
        >
          <ChevronRight size={16} />
        </button>
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col
          bg-[var(--bg-secondary)] border-r border-[var(--surface-border)]
          transition-all duration-200 ease-out
          ${isMobile ? (mobileOpen ? 'w-60 translate-x-0' : '-translate-x-full w-60') : sidebarWidth}
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center h-12 px-4 border-b border-[var(--surface-border)] flex-shrink-0">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center flex-shrink-0">
              <Hexagon size={14} className="text-[var(--bg-primary)]" />
            </div>
            {!collapsed && (
              <span className="text-sm font-bold text-[var(--text-primary)] truncate gradient-text">
                Crypto Vision
              </span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 scrollbar-thin">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {group.title}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href + item.label}>
                      <Link
                        href={item.href}
                        className={`sidebar-nav-item ${active ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <div className="border-t border-[var(--surface-border)] p-2 flex-shrink-0">
            <button
              onClick={toggle}
              className={`sidebar-nav-item w-full ${collapsed ? 'justify-center px-0' : ''}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!collapsed && <span className="truncate">Collapse</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

export default Sidebar;
