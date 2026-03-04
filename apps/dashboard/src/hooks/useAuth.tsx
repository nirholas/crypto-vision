/**
 * Auth Hook
 * 
 * React hook for authentication state management
 */

'use client';

import { useState, useEffect, useCallback, useMemo, createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// TYPES
// =============================================================================

export interface User {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: 'user' | 'premium' | 'admin';
  provider: string | null;
  emailVerified: boolean;
  settings?: {
    theme?: 'light' | 'dark' | 'system';
    notifications?: boolean;
    newsletter?: boolean;
  };
}

export interface Session {
  id: string;
  expiresAt: number;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthActions {
  signIn: (provider: 'google' | 'github' | 'discord' | 'twitter') => Promise<void>;
  signInWithEmail: (email: string) => Promise<{ success: boolean; message?: string }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export type AuthContextType = AuthState & AuthActions;

// =============================================================================
// CONTEXT
// =============================================================================

const AuthContext = createContext<AuthContextType | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current session
  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const data = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setSession(data.session);
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (error) {
      console.error('Session fetch error:', error);
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial session fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Sign in with OAuth
  const signIn = useCallback(async (provider: 'google' | 'github' | 'discord' | 'twitter') => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'oauth',
          provider,
          redirectTo: window.location.pathname,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate sign in');
      }

      // Redirect to OAuth provider
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }, []);

  // Sign in with email (magic link)
  const signInWithEmail = useCallback(async (email: string) => {
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'magic-link',
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send magic link');
      }

      return { success: true, message: 'Magic link sent to your email' };
    } catch (error) {
      console.error('Email sign in error:', error);
      return { success: false, message: (error as Error).message };
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signout' }),
        credentials: 'include',
      });

      setUser(null);
      setSession(null);
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, [router]);

  // Refresh session
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchSession();
  }, [fetchSession]);

  // Memoized context value
  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    isLoading,
    isAuthenticated: !!user && !!session,
    signIn,
    signInWithEmail,
    signOut,
    refresh,
  }), [user, session, isLoading, signIn, signInWithEmail, signOut, refresh]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo = '/auth/login') {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`${redirectTo}?redirect=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}

/**
 * Hook to check if user has specific role
 */
export function useRole(requiredRole: 'user' | 'premium' | 'admin') {
  const { user, isLoading } = useAuth();

  const hasRole = useMemo(() => {
    if (!user) return false;
    
    const roleHierarchy = { user: 0, premium: 1, admin: 2 };
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }, [user, requiredRole]);

  return { hasRole, isLoading };
}

/**
 * Hook to require premium or admin role
 */
export function useRequirePremium(redirectTo = '/pricing') {
  const { hasRole, isLoading } = useRole('premium');
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasRole) {
      router.push(redirectTo);
    }
  }, [hasRole, isLoading, isAuthenticated, router, redirectTo]);

  return { isPremium: hasRole, isLoading };
}

export default useAuth;
