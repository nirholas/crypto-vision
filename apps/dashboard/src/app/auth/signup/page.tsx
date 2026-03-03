/**
 * Sign Up Page
 */

import { Suspense } from 'react';
import AuthPage from '@/components/auth/AuthPage';

export const metadata = {
  title: 'Create Account | CryptoNews',
  description: 'Create your free CryptoNews account to track crypto news, sync portfolios, and set up personalized alerts.',
};

function SignUpPageContent() {
  return <AuthPage mode="signup" />;
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-secondary">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignUpPageContent />
    </Suspense>
  );
}
