'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isConnected) {
      router.push('/connect');
    }
  }, [isConnected, isLoading, router]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!isConnected) return null;

  return <>{children}</>;
}
