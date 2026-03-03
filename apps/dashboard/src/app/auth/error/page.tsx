/**
 * Auth Error Page
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

const errorMessages: Record<string, { title: string; message: string }> = {
  missing_token: {
    title: 'Missing Token',
    message: 'The magic link appears to be incomplete. Please request a new one.',
  },
  invalid_token: {
    title: 'Invalid Link',
    message: 'This magic link is invalid. It may have been used already.',
  },
  expired_token: {
    title: 'Link Expired',
    message: 'This magic link has expired. Please request a new one.',
  },
  verification_failed: {
    title: 'Verification Failed',
    message: 'We could not verify your email. Please try again.',
  },
  missing_parameters: {
    title: 'Missing Parameters',
    message: 'The authentication request is missing required parameters.',
  },
  invalid_provider: {
    title: 'Invalid Provider',
    message: 'The authentication provider is not supported.',
  },
  callback_failed: {
    title: 'Authentication Failed',
    message: 'There was a problem completing your sign in. Please try again.',
  },
  access_denied: {
    title: 'Access Denied',
    message: 'You denied the authentication request. Please try again if this was a mistake.',
  },
  default: {
    title: 'Authentication Error',
    message: 'An unexpected error occurred during authentication. Please try again.',
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error') || 'default';
  const errorInfo = errorMessages[errorCode] || errorMessages.default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background-secondary to-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-surface-border/50 p-8 text-center">
          {/* Error icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <AlertCircle className="w-8 h-8 text-red-400" />
          </motion.div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            {errorInfo.title}
          </h1>

          {/* Message */}
          <p className="text-text-secondary mb-8">
            {errorInfo.message}
          </p>

          {/* Error code (for debugging) */}
          <p className="text-xs text-surface-hover mb-6 font-mono">
            Error code: {errorCode}
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Link>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-surface-border hover:bg-surface-hover text-white font-medium rounded-lg transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>

          {/* Help link */}
          <p className="mt-6 text-sm text-text-muted">
            Need help?{' '}
            <a href="/support" className="text-blue-400 hover:text-blue-300">
              Contact support
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-secondary">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
