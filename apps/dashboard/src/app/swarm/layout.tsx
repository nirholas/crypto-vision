'use client';

import { ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Rocket,
  Wallet,
  Bot,
  ArrowLeftRight,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';

/* ─── Sub-Navigation Tabs ────────────────────────────────────── */

interface SwarmTab {
  label: string;
  href: string;
  icon: ReactNode;
  description: string;
}

const SWARM_TABS: SwarmTab[] = [
  {
    label: 'Overview',
    href: '/swarm',
    icon: <LayoutDashboard size={16} />,
    description: 'Dashboard & status',
  },
  {
    label: 'Launch',
    href: '/swarm/launch',
    icon: <Rocket size={16} />,
    description: 'Deploy new token',
  },
  {
    label: 'Wallets',
    href: '/swarm/wallets',
    icon: <Wallet size={16} />,
    description: 'Fund & manage',
  },
  {
    label: 'Agents',
    href: '/swarm/agents',
    icon: <Bot size={16} />,
    description: 'Monitor agents',
  },
  {
    label: 'Trades',
    href: '/swarm/trades',
    icon: <ArrowLeftRight size={16} />,
    description: 'History & P&L',
  },
  {
    label: 'Settings',
    href: '/swarm/settings',
    icon: <Settings size={16} />,
    description: 'Configuration',
  },
];

/* ─── Layout ─────────────────────────────────────────────────── */

export default function SwarmLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const activeTab = useMemo(() => {
    // Exact match for /swarm, prefix match for sub-pages
    if (pathname === '/swarm') return '/swarm';
    return SWARM_TABS.find((t) => t.href !== '/swarm' && pathname.startsWith(t.href))?.href ?? '/swarm';
  }, [pathname]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--secondary)] flex items-center justify-center">
            <Zap size={20} className="text-[var(--bg-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Pump Agent Swarm</h1>
            <p className="text-xs text-[var(--text-muted)]">Autonomous token deployment & trading</p>
          </div>
        </div>
        <SwarmConnectionStatus />
      </div>

      {/* Tab Navigation */}
      <nav className="flex gap-1 p-1 bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] overflow-x-auto scrollbar-thin">
        {SWARM_TABS.map((tab) => {
          const isActive = activeTab === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all
                ${
                  isActive
                    ? 'bg-[var(--brand)]/15 text-[var(--brand)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                }
              `}
              title={tab.description}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Page Content */}
      {children}
    </div>
  );
}

/* ─── Connection Status Indicator ────────────────────────────── */

function SwarmConnectionStatus() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--surface-border)]">
      <Shield size={14} className="text-[var(--text-muted)]" />
      <span className="text-xs text-[var(--text-secondary)]">Swarm API</span>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand)] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand)]" />
      </span>
    </div>
  );
}
