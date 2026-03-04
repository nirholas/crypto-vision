'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Sidebar } from '@/components/ui/Sidebar';
import { TopBar } from '@/components/ui/TopBar';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface AppShellProps {
  children: ReactNode;
}

/* ─── Component ──────────────────────────────────────────────────────── */

/**
 * AppShell wraps all page content with the sidebar + topbar layout.
 * Manages the collapsed state and coordinates between sidebar/topbar.
 */
export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Listen for sidebar collapse changes (the sidebar manages its own state, but
  // we track it here to shift the main content area accordingly)
  // We use a MutationObserver-free approach: the sidebar width is determined by
  // its own state, and we mirror that here via a shared context-free approach.
  // Since the Sidebar component manages its own collapse state, we use a simpler
  // CSS-based approach with the sidebar's width transition.

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <Sidebar defaultCollapsed={false} />

      {/* Main area */}
      <div
        className="
          flex-1 flex flex-col min-w-0
          ml-60 max-md:ml-0
          transition-[margin-left] duration-200 ease-out
        "
      >
        {/* TopBar */}
        <TopBar sidebarCollapsed={sidebarCollapsed} />

        {/* Main Content */}
        <main
          id="main-content"
          className="
            flex-1 overflow-y-auto overflow-x-hidden
            pt-12
            scrollbar-thin
          "
        >
          <div className="p-4 md:p-6 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
