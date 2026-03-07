import { create } from 'zustand';
import type { Alert } from '@/types';

interface SwarmStore {
  // Session
  sessionId: string | null;
  walletAddress: string | null;
  setSession: (sessionId: string, walletAddress: string) => void;
  clearSession: () => void;

  // Swarm state
  phase: string;
  mint: string | null;
  setPhase: (phase: string) => void;
  setMint: (mint: string) => void;

  // Alerts
  alerts: Alert[];
  unreadCount: number;
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  markAllRead: () => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  alertPanelOpen: boolean;
  toggleAlertPanel: () => void;
}

export const useSwarmStore = create<SwarmStore>((set) => ({
  sessionId: null,
  walletAddress: null,
  setSession: (sessionId, walletAddress) => set({ sessionId, walletAddress }),
  clearSession: () => set({ sessionId: null, walletAddress: null }),

  phase: 'idle',
  mint: null,
  setPhase: (phase) => set({ phase }),
  setMint: (mint) => set({ mint }),

  alerts: [],
  unreadCount: 0,
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 200),
      unreadCount: state.unreadCount + 1,
    })),
  markAlertRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, readAt: Date.now() } : a)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllRead: () =>
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, readAt: a.readAt ?? Date.now() })),
      unreadCount: 0,
    })),

  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  alertPanelOpen: false,
  toggleAlertPanel: () => set((state) => ({ alertPanelOpen: !state.alertPanelOpen })),
}));
