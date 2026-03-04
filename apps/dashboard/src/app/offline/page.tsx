import Link from 'next/link';
import type { Metadata } from 'next';
import { WifiOff, RefreshCw, Home, Info } from 'lucide-react';
import RefreshButton from '@/components/RefreshButton';

export const metadata: Metadata = {
  title: 'Offline | Crypto Vision',
  description: 'You are currently offline. Please check your internet connection.',
  robots: { index: false, follow: false },
};

const tips = [
  'Check your Wi-Fi or mobile data connection',
  'Try moving to an area with better signal',
  'Previously viewed pages may be available from cache',
  'The app will automatically reconnect when online',
];

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Animated offline icon */}
        <div className="relative w-28 h-28 mx-auto">
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: 'rgba(255, 170, 0, 0.12)' }}
          />
          <div
            className="absolute inset-2 rounded-full animate-pulse"
            style={{ background: 'rgba(255, 170, 0, 0.18)' }}
          />
          <div
            className="absolute inset-4 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--warning), #ff8800)',
              boxShadow: '0 8px 32px rgba(255, 170, 0, 0.3)',
            }}
          >
            <WifiOff className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            You&apos;re Offline
          </h1>
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            Your internet connection was lost.
            Cached content may still be available.
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <RefreshButton />

          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--surface-border)',
            }}
          >
            <Home className="w-4 h-4" />
            Go to Home (Cached)
          </Link>
        </div>

        {/* Tips */}
        <div
          className="rounded-xl p-5 text-left"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
          }}
        >
          <h2
            className="font-semibold mb-3 flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            <Info className="w-4 h-4" style={{ color: 'var(--warning)' }} />
            What you can do
          </h2>
          <ul className="space-y-2">
            {tips.map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--warning)' }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--loss)' }} />
          Currently offline
        </div>
      </div>
    </div>
  );
}
