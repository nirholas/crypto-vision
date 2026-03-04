/**
 * User Menu Component
 * 
 * Dropdown menu for authenticated users with profile, settings, and signout
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Wallet,
  Bell,
  Star,
  Shield,
  RefreshCw,
  ExternalLink,
  Loader2,
  Bookmark,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UserData {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: 'user' | 'premium' | 'admin';
  provider?: string;
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean;
    newsletter?: boolean;
  };
}

interface UserMenuProps {
  user: UserData;
  onSignOut?: () => void;
  className?: string;
}

export function UserMenu({ user, onSignOut, className }: UserMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signout' }),
      });
      
      onSignOut?.();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  }, [router, onSignOut]);

  // Get initials for avatar
  const getInitials = () => {
    if (user.name) {
      return user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Role badge colors
  const roleColors = {
    user: 'bg-surface-hover',
    premium: 'bg-gradient-to-r from-amber-500 to-yellow-500',
    admin: 'bg-gradient-to-r from-purple-500 to-pink-500',
  };

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 p-1.5 rounded-lg',
          'hover:bg-surface transition-colors duration-200',
          isOpen && 'bg-surface'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Avatar */}
        <div className="relative">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name || 'User avatar'}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {getInitials()}
              </span>
            </div>
          )}
          
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background-secondary" />
        </div>

        {/* Name (hidden on mobile) */}
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-white truncate max-w-[120px]">
            {user.name || 'User'}
          </div>
          {user.role && user.role !== 'user' && (
            <div className={cn(
              'text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full inline-block',
              roleColors[user.role],
              'text-white'
            )}>
              {user.role}
            </div>
          )}
        </div>

        <ChevronDown className={cn(
          'w-4 h-4 text-text-secondary transition-transform duration-200',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute right-0 top-full mt-2 z-50',
              'w-64 py-2',
              'bg-surface border border-surface-border rounded-xl shadow-xl',
              'ring-1 ring-black/5'
            )}
          >
            {/* User info header */}
            <div className="px-4 py-3 border-b border-surface-border">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={`${user.name || 'User'} profile picture`}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <span className="text-lg font-medium text-white">
                      {getInitials()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.name || 'User'}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              
              {/* Provider badge */}
              {user.provider && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                  <Shield className="w-3 h-3" />
                  <span>Signed in with {user.provider}</span>
                </div>
              )}
            </div>

            {/* Menu items */}
            <div className="py-2">
              <MenuItem
                icon={User}
                label="Profile"
                onClick={() => {
                  router.push('/profile');
                  setIsOpen(false);
                }}
              />
              <MenuItem
                icon={Wallet}
                label="Connected Exchanges"
                onClick={() => {
                  router.push('/settings/exchanges');
                  setIsOpen(false);
                }}
              />
              <MenuItem
                icon={Bell}
                label="Notification Settings"
                onClick={() => {
                  router.push('/settings/notifications');
                  setIsOpen(false);
                }}
              />
              <MenuItem
                icon={Star}
                label="Watchlist & Alerts"
                onClick={() => {
                  router.push('/watchlist');
                  setIsOpen(false);
                }}
              />
              <MenuItem
                icon={Bookmark}
                label="Bookmarks"
                onClick={() => {
                  router.push('/bookmarks');
                  setIsOpen(false);
                }}
              />
              <MenuItem
                icon={Settings}
                label="Settings"
                onClick={() => {
                  router.push('/settings');
                  setIsOpen(false);
                }}
              />
            </div>

            {/* Premium upsell for non-premium users */}
            {user.role === 'user' && (
              <div className="px-2 py-2 border-t border-surface-border">
                <button
                  onClick={() => {
                    router.push('/pricing');
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
                    'bg-gradient-to-r from-amber-500/10 to-yellow-500/10',
                    'border border-amber-500/20',
                    'hover:from-amber-500/20 hover:to-yellow-500/20',
                    'transition-all duration-200'
                  )}
                >
                  <Star className="w-4 h-4 text-amber-400" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-amber-400">
                      Upgrade to Premium
                    </p>
                    <p className="text-xs text-amber-400/70">
                      Get advanced features
                    </p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-amber-400/50" />
                </button>
              </div>
            )}

            {/* Sign out */}
            <div className="pt-2 border-t border-surface-border">
              <MenuItem
                icon={isLoading ? Loader2 : LogOut}
                label={isLoading ? 'Signing out...' : 'Sign out'}
                onClick={handleSignOut}
                danger
                disabled={isLoading}
                iconClassName={isLoading ? 'animate-spin' : undefined}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// MENU ITEM COMPONENT
// =============================================================================

interface MenuItemProps {
  icon: typeof User;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  iconClassName?: string;
}

function MenuItem({ 
  icon: Icon, 
  label, 
  onClick, 
  danger, 
  disabled,
  iconClassName 
}: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2 text-left',
        'transition-colors duration-150',
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-text-secondary hover:bg-surface-border/50 hover:text-white',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Icon className={cn('w-4 h-4', iconClassName)} />
      <span className="text-sm">{label}</span>
    </button>
  );
}

export default UserMenu;
