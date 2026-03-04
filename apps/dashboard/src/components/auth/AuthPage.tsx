/**
 * Authentication Page
 * 
 * Handles login/signup with OAuth and magic links
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Mail,
  ArrowRight,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  Shield,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// OAuth provider icons (inline SVGs for bundle size)
const OAuthIcons = {
  google: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  github: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  ),
  discord: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

interface AuthPageProps {
  mode?: 'login' | 'signup';
}

export default function AuthPage({ mode = 'login' }: AuthPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Handle magic link submission
  const handleMagicLink = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

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

      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  // Handle OAuth login
  const handleOAuth = useCallback(async (provider: string) => {
    setLoadingProvider(provider);
    setError(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'oauth',
          provider,
          redirectTo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate OAuth');
      }

      // Redirect to OAuth provider
      window.location.href = data.authUrl;
    } catch (err) {
      setError((err as Error).message);
      setLoadingProvider(null);
    }
  }, [redirectTo]);

  // Success state - check email
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background-secondary to-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-surface-border/50 p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Check className="w-8 h-8 text-green-400" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              Check your email
            </h1>
            <p className="text-text-secondary mb-6">
              We sent a magic link to <span className="text-white">{email}</span>
            </p>
            
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Click the link in your email to sign in. The link expires in 15 minutes.
              </p>
              
              <button
                onClick={() => setSuccess(false)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Use a different email
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-background via-background-secondary to-background">
      {/* Left side - branding */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-center px-12 xl:px-20">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">CryptoNews</span>
          </div>
          
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
            Real-time crypto intelligence,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              all in one place
            </span>
          </h1>
          
          <div className="space-y-4 mt-8">
            <FeatureItem icon={Zap} text="Instant news from 50+ sources" />
            <FeatureItem icon={Shield} text="Secure portfolio sync" />
            <FeatureItem icon={Mail} text="Personalized alerts" />
          </div>
        </motion.div>
      </div>

      {/* Right side - auth form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-surface-border/50 p-8">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">CryptoNews</span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-text-secondary mb-8">
              {mode === 'signup' 
                ? 'Start tracking crypto news and portfolios'
                : 'Sign in to access your dashboard'
              }
            </p>

            {/* Error message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6"
                >
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-sm text-red-400">{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* OAuth providers */}
            <div className="space-y-3 mb-6">
              {(['google', 'github', 'discord', 'twitter'] as const).map((provider) => (
                <OAuthButton
                  key={provider}
                  provider={provider}
                  isLoading={loadingProvider === provider}
                  disabled={loadingProvider !== null}
                  onClick={() => handleOAuth(provider)}
                />
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-surface-border" />
              <span className="text-sm text-text-muted">or continue with email</span>
              <div className="flex-1 h-px bg-surface-border" />
            </div>

            {/* Magic link form */}
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className={cn(
                      'w-full pl-10 pr-4 py-3 bg-background-secondary/50 border border-surface-border rounded-lg',
                      'text-white placeholder-text-muted',
                      'focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500',
                      'transition-all duration-200'
                    )}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 px-4',
                  'bg-gradient-to-r from-blue-500 to-purple-600',
                  'hover:from-blue-600 hover:to-purple-700',
                  'text-white font-medium rounded-lg',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Continue with email</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="mt-6 text-center text-sm text-text-muted">
              By continuing, you agree to our{' '}
              <a href="/terms" className="text-blue-400 hover:text-blue-300">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-blue-400 hover:text-blue-300">
                Privacy Policy
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function FeatureItem({ icon: Icon, text }: { icon: typeof Zap; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-surface rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-blue-400" />
      </div>
      <span className="text-text-secondary">{text}</span>
    </div>
  );
}

interface OAuthButtonProps {
  provider: keyof typeof OAuthIcons;
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}

function OAuthButton({ provider, isLoading, disabled, onClick }: OAuthButtonProps) {
  const names: Record<string, string> = {
    google: 'Google',
    github: 'GitHub',
    discord: 'Discord',
    twitter: 'X (Twitter)',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-center gap-3 py-3 px-4',
        'bg-background-secondary/50 border border-surface-border rounded-lg',
        'text-white font-medium',
        'hover:bg-surface-border/50 hover:border-surface-hover',
        'transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        OAuthIcons[provider]
      )}
      <span>Continue with {names[provider]}</span>
    </button>
  );
}
