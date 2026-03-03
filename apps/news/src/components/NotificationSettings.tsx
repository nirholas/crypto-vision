'use client';

import { useState } from 'react';
import { usePWASafe } from './PWAProvider';

interface NotificationSettingsProps {
  className?: string;
}

export function NotificationSettings({ className = '' }: NotificationSettingsProps) {
  const pwa = usePWASafe();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pwa?.isPushSupported) {
    return null;
  }

  const handleToggle = async () => {
    if (pwa.isPushEnabled) {
      // For now, we don't support unsubscribing through UI
      // They can do it through browser settings
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await pwa.requestPushPermission();
      if (!success) {
        setError('Could not enable notifications. Please check your browser settings.');
      }
    } catch (err) {
      setError('An error occurred while enabling notifications.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <p className="text-white font-medium">Push Notifications</p>
            <p className="text-gray-400 text-sm">Get alerts for breaking news</p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading || pwa.isPushEnabled}
          className={`relative w-14 h-8 rounded-full transition-colors ${
            pwa.isPushEnabled 
              ? 'bg-green-500' 
              : 'bg-gray-600 hover:bg-gray-500'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span 
            className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
              pwa.isPushEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-sm">{error}</p>
      )}

      {pwa.isPushEnabled && (
        <p className="mt-3 text-green-400 text-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Notifications enabled
        </p>
      )}
    </div>
  );
}
