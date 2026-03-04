'use client';

import React, { useState, useCallback } from 'react';

interface SwarmStarterProps {
  onStarted?: () => void;
  onError?: (error: Error) => void;
}

export function SwarmStarter({ onStarted, onError }: SwarmStarterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSwarm = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const openRouterApiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

      if (!openRouterApiKey) {
        throw new Error('OpenRouter API key not configured. Set NEXT_PUBLIC_OPENROUTER_API_KEY environment variable.');
      }

      const response = await fetch('/api/swarm/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openRouterApiKey,
          audience: 'technical',
          presenterName: 'AI Swarm Demo',
          hackathonName: 'Live Demonstration',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start swarm');
      }

      const data = await response.json();
      console.log('Swarm started:', data);

      if (onStarted) {
        onStarted();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onStarted, onError]);

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-lg">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🚀 Start Swarm Demo
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Launch an autonomous AI agent swarm that creates, trades, and manages tokens on Solana.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Real-time AI narration explaining agent actions
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Live metrics dashboard (budget, trades, P&L, ROI)
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Full event feed showing every autonomous decision
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Beautiful presentation-ready formatting
          </span>
        </div>
      </div>

      <button
        onClick={startSwarm}
        disabled={isLoading}
        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
          isLoading
            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:shadow-lg'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span>
            Starting Swarm...
          </span>
        ) : (
          '🤖 Start Demo'
        )}
      </button>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
        The swarm will run for ~5 minutes. Monitor progress in real-time below!
      </p>
    </div>
  );
}
