/**
 * Auth Components Index
 * 
 * Exports all authentication-related components
 */

export { default as AuthPage } from './AuthPage';
export { UserMenu, type UserData } from './UserMenu';

// Re-export auth hook for convenience
export { useAuth, AuthProvider, useRequireAuth, useRole, useRequirePremium } from '@/hooks/useAuth';
export type { User, Session, AuthState, AuthActions, AuthContextType } from '@/hooks/useAuth';
