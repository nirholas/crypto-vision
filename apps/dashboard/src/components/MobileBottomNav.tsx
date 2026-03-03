/**
 * Mobile Bottom Navigation
 * 
 * Fixed bottom navigation bar for mobile devices.
 * Shows 5 key navigation items with icons and labels.
 * Includes safe area padding for notched devices.
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  TrendingUp,
  Search,
  Bell,
  User,
  Wallet,
  Bookmark,
  Star,
} from 'lucide-react';
import { useViewport } from '@/lib/mobile-responsive';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/markets', label: 'Markets', icon: TrendingUp },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/watchlist', label: 'Watchlist', icon: Star },
  { href: '/profile', label: 'Profile', icon: User, requiresAuth: true },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { isMobile, isTablet } = useViewport();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Only show on mobile devices
  if (!isMobile && !isTablet) {
    return null;
  }

  // Hide on certain pages
  const hideOnPages = ['/auth/login', '/auth/signup', '/auth/error'];
  if (hideOnPages.some(page => pathname.startsWith(page))) {
    return null;
  }

  return (
    <>
      {/* Spacer to prevent content from being hidden behind nav */}
      <div className="h-[calc(4rem+env(safe-area-inset-bottom))] lg:hidden" />
      
      {/* Navigation bar */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
          'bg-background/95 backdrop-blur-lg',
          'border-t border-surface-border',
          'pb-[env(safe-area-inset-bottom)]'
        )}
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {navItems.map((item) => {
            // Skip auth-required items if not authenticated
            if (item.requiresAuth && !isAuthenticated && !authLoading) {
              return (
                <NavItem
                  key={item.href}
                  href="/auth/login"
                  icon={item.icon}
                  label="Sign In"
                  isActive={false}
                />
              );
            }

            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

            return (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={isActive}
              />
            );
          })}
        </div>
      </nav>
    </>
  );
}

// =============================================================================
// NAV ITEM COMPONENT
// =============================================================================

interface NavItemProps {
  href: string;
  icon: typeof Home;
  label: string;
  isActive: boolean;
  badge?: number;
}

function NavItem({ href, icon: Icon, label, isActive, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex flex-col items-center justify-center',
        'min-w-[44px] min-h-[44px] px-3 py-1',
        'rounded-xl transition-colors duration-200',
        'active:scale-95',
        isActive
          ? 'text-primary'
          : 'text-text-muted hover:text-text-primary'
      )}
    >
      {/* Active indicator */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="bottomNavIndicator"
            className="absolute inset-0 bg-primary/10 rounded-xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}
      </AnimatePresence>

      {/* Icon */}
      <div className="relative z-10">
        <Icon
          className={cn(
            'w-6 h-6 transition-transform duration-200',
            isActive && 'scale-110'
          )}
          strokeWidth={isActive ? 2.5 : 2}
        />
        
        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <span className={cn(
            'absolute -top-1 -right-1 min-w-[18px] h-[18px]',
            'flex items-center justify-center',
            'text-[10px] font-bold text-white',
            'bg-red-500 rounded-full px-1'
          )}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </div>

      {/* Label */}
      <span
        className={cn(
          'relative z-10 text-[10px] font-medium mt-0.5 truncate max-w-full',
          isActive && 'font-semibold'
        )}
      >
        {label}
      </span>
    </Link>
  );
}

// =============================================================================
// FLOATING ACTION BUTTON (Optional enhancement)
// =============================================================================

interface FloatingActionButtonProps {
  onClick: () => void;
  icon?: typeof Home;
  label?: string;
  className?: string;
}

export function FloatingActionButton({
  onClick,
  icon: Icon = Search,
  label = 'Action',
  className,
}: FloatingActionButtonProps) {
  const { isMobile, isTablet, safeAreaInsets } = useViewport();

  if (!isMobile && !isTablet) {
    return null;
  }

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        'fixed z-40 lg:hidden',
        'w-14 h-14 rounded-full',
        'bg-gradient-to-r from-blue-500 to-purple-600',
        'text-white shadow-lg shadow-blue-500/30',
        'flex items-center justify-center',
        'active:scale-95 transition-transform',
        className
      )}
      style={{
        right: 16,
        bottom: `calc(4rem + ${safeAreaInsets.bottom}px + 16px)`,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={label}
    >
      <Icon className="w-6 h-6" />
    </motion.button>
  );
}

export default MobileBottomNav;
