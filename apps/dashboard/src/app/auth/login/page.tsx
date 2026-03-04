/**
 * Login Page
 */

import { Suspense } from 'react';
import AuthPage from '@/components/auth/AuthPage';

export const metadata = {
  title: 'Sign In | CryptoNews',
  description: 'Sign in to your CryptoNews account to access your dashboard, watchlists, and personalized alerts.',
};

function LoginPageContent() {
  return <AuthPage mode="login" />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background-secondary">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
