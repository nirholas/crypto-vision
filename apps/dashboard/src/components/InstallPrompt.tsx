'use client';

import { useState, useEffect } from 'react';
import { usePWASafe } from './PWAProvider';
import Link from 'next/link';

export function InstallPrompt() {
  const pwa = usePWASafe();
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden
  const [hasShownThisSession, setHasShownThisSession] = useState(false);

  useEffect(() => {
    // Check if already shown this session
    const shownThisSession = sessionStorage.getItem('pwa-install-shown');
    if (shownThisSession) {
      setHasShownThisSession(true);
      return;
    }

    // Check if dismissed for 30 days
    const dismissedAt = localStorage.getItem('pwa-install-dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < thirtyDays) {
        setIsDismissed(true);
        return;
      }
    }

    // Show after a delay (less intrusive)
    const timer = setTimeout(() => {
      setIsDismissed(false);
      sessionStorage.setItem('pwa-install-shown', 'true');
    }, 5000); // Wait 5 seconds before showing

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if not installable, already installed, dismissed, or shown this session
  if (!pwa || pwa.isInstalled || isDismissed || hasShownThisSession) {
    return null;
  }

  if (!pwa.isInstallable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-fade-in">
      <div className="bg-surface border border-surface-border rounded-lg p-3 flex items-center gap-3">
        <span className="text-white text-sm">Install app for a better experience</span>
        <Link
          href="/install"
          onClick={handleDismiss}
          className="text-white/70 hover:text-white text-sm underline underline-offset-2 whitespace-nowrap"
        >
          Learn more
        </Link>
        <button
          onClick={handleDismiss}
          className="ml-auto p-1 text-white/50 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
