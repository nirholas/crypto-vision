'use client';

import { useAuth } from '@/hooks/useAuth';
import { useSwarmStore } from '@/stores/swarm-store';
import { useSwarmStatus } from '@/hooks/useRealtimeData';
import { truncateAddress, formatSol, formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell,
  Menu,
  LogOut,
  Copy,
  Play,
  Pause,
  Square,
  AlertOctagon,
} from 'lucide-react';
import { toast } from '@/components/ui/toast';
import * as api from '@/lib/api-client';

export function Topbar() {
  const { walletAddress, disconnect } = useAuth();
  const { phase, unreadCount, toggleSidebar, toggleAlertPanel } = useSwarmStore();
  const { status } = useSwarmStatus();

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast({ title: 'Address copied', variant: 'success', duration: 2000 });
    }
  };

  const isRunning = status && !['idle', 'completed', 'error', 'configuring'].includes(status.phase);

  return (
    <header className="h-14 border-b border-border bg-bg-secondary/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
          <Menu className="h-4 w-4" />
        </Button>

        {status && (
          <div className="flex items-center gap-3">
            <Badge variant={isRunning ? 'success' : 'outline'}>
              {status.phase.replace(/_/g, ' ')}
            </Badge>
            {isRunning && status.uptime > 0 && (
              <span className="text-xs text-text-muted mono">
                {formatDuration(status.uptime)}
              </span>
            )}
            {status.totalTrades > 0 && (
              <span className="text-xs text-text-secondary">
                {status.totalTrades} trades
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isRunning && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => api.pauseSwarm()}
              title="Pause Swarm"
            >
              <Pause className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => api.resumeSwarm()}
              title="Resume Swarm"
            >
              <Play className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => api.stopSwarm()}
              title="Stop Swarm"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon-sm"
              onClick={() => {
                if (confirm('Emergency stop: sell all positions and halt all agents?')) {
                  api.emergencyStop();
                }
              }}
              title="Emergency Stop"
            >
              <AlertOctagon className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button variant="ghost" size="icon-sm" className="relative" onClick={toggleAlertPanel}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent-red text-[10px] flex items-center justify-center text-white font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {walletAddress && (
          <button
            onClick={copyAddress}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-accent-green" />
            <span className="mono">{truncateAddress(walletAddress)}</span>
            <Copy className="h-3 w-3" />
          </button>
        )}

        <Button variant="ghost" size="icon-sm" onClick={disconnect} title="Disconnect">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
