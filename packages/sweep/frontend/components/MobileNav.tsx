"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Mobile bottom navigation bar for easy access to main sections
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: "🏠", label: "Home" },
    { href: "/consolidate", icon: "🔄", label: "Consolidate" },
    { href: "/defi", icon: "📈", label: "DeFi" },
    { href: "/subscriptions", icon: "📅", label: "Subs" },
    { href: "/history", icon: "📋", label: "History" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/" && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full text-center transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-xl mb-0.5">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Floating action button for quick sweep action
 */
export function FloatingActionButton() {
  const pathname = usePathname();
  
  // Don't show on dashboard since sweep is already prominent there
  if (pathname === "/" || pathname === "/dashboard") {
    return null;
  }

  return (
    <Link
      href="/"
      className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-105 active:scale-95 transition-transform"
    >
      🧹
    </Link>
  );
}

/**
 * Pull to refresh wrapper (visual indicator only - actual refresh handled by parent)
 */
interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}

export function PullToRefreshWrapper({ children, onRefresh, refreshing }: PullToRefreshProps) {
  // Note: Full implementation would require touch event handling
  // This provides the visual structure
  return (
    <div className="relative">
      {refreshing && (
        <div className="absolute top-0 left-0 right-0 flex justify-center py-4 z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="animate-spin">🔄</span>
            <span>Refreshing...</span>
          </div>
        </div>
      )}
      <div className={refreshing ? "mt-12 transition-transform" : ""}>
        {children}
      </div>
    </div>
  );
}

/**
 * Swipeable card for mobile gestures
 */
interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: { icon: string; label: string; color?: string };
  rightAction?: { icon: string; label: string; color?: string };
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
}: SwipeableCardProps) {
  // Note: Full implementation would require touch event handling
  // This provides the visual structure
  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Left action reveal */}
      {leftAction && (
        <div className="absolute inset-y-0 left-0 w-20 flex items-center justify-center bg-green-500 text-white">
          <div className="text-center">
            <span className="text-xl">{leftAction.icon}</span>
            <p className="text-xs">{leftAction.label}</p>
          </div>
        </div>
      )}
      
      {/* Right action reveal */}
      {rightAction && (
        <div className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-red-500 text-white">
          <div className="text-center">
            <span className="text-xl">{rightAction.icon}</span>
            <p className="text-xs">{rightAction.label}</p>
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div className="relative bg-card z-10 transition-transform">
        {children}
      </div>
    </div>
  );
}

/**
 * Collapsible section for mobile space optimization
 */
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        <span className={`transition-transform ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {isOpen && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}
