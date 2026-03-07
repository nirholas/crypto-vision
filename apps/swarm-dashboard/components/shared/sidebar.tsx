'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSwarmStore } from '@/stores/swarm-store';
import {
  LayoutDashboard,
  Wallet,
  Bot,
  ArrowRightLeft,
  LineChart,
  BarChart3,
  FileCode,
  Settings,
  Eye,
  Crosshair,
  Zap,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/wallets', label: 'Wallets', icon: Wallet },
  { href: '/dashboard/agents', label: 'Agents', icon: Bot },
  { href: '/dashboard/trading', label: 'Trading', icon: ArrowRightLeft },
  { href: '/dashboard/charts', label: 'Charts', icon: LineChart },
  { href: '/dashboard/visualizer', label: 'Visualizer', icon: Eye },
  { href: '/dashboard/tracking', label: 'Tracking', icon: Crosshair },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/templates', label: 'Templates', icon: FileCode },
  { href: '/dashboard/deploy', label: 'Quick Deploy', icon: Zap },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useSwarmStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 h-screen bg-bg-secondary border-r border-border transition-all duration-300 flex flex-col',
        sidebarOpen ? 'w-56' : 'w-16',
      )}
    >
      <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center text-black font-bold text-sm">
          PS
        </div>
        {sidebarOpen && (
          <span className="text-sm font-semibold text-text-primary whitespace-nowrap">
            Pump Swarm
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <div className={cn('flex items-center gap-2 px-3 py-2', sidebarOpen ? '' : 'justify-center')}>
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
          {sidebarOpen && <span className="text-xs text-text-muted">Connected</span>}
        </div>
      </div>
    </aside>
  );
}
