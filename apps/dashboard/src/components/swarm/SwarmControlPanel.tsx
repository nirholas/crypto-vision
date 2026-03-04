'use client';

import React, { useState } from 'react';
import { swarmApi } from '@/lib/swarm-api';

// ─── Props ────────────────────────────────────────────────────

interface SwarmControlPanelProps {
  phase: string | null;
  onAction?: (action: string) => void;
}

// ─── Component ────────────────────────────────────────────────

export function SwarmControlPanel({ phase, onAction }: SwarmControlPanelProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPaused = phase === 'paused';
  const isRunning = phase !== null && !['idle', 'completed', 'error', 'emergency_exit', 'paused'].includes(phase);
  const isStopped = phase === null || ['idle', 'completed', 'error', 'emergency_exit'].includes(phase);

  const executeAction = async (action: string, apiCall: () => Promise<void>) => {
    setLoadingAction(action);
    setError(null);
    try {
      await apiCall();
      onAction?.(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEmergencyStop = () => {
    setShowEmergencyConfirm(false);
    executeAction('emergency-stop', swarmApi.emergencyStop);
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-200">Control Panel</h3>

      {error && (
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Pause */}
        {isRunning && (
          <ActionButton
            label="Pause"
            icon="⏸"
            onClick={() => executeAction('pause', swarmApi.pauseSwarm)}
            loading={loadingAction === 'pause'}
            variant="warning"
          />
        )}

        {/* Resume */}
        {isPaused && (
          <ActionButton
            label="Resume"
            icon="▶️"
            onClick={() => executeAction('resume', swarmApi.resumeSwarm)}
            loading={loadingAction === 'resume'}
            variant="success"
          />
        )}

        {/* Trigger Exit */}
        {(isRunning || isPaused) && (
          <ActionButton
            label="Exit"
            icon="🚪"
            onClick={() => executeAction('exit', swarmApi.triggerExit)}
            loading={loadingAction === 'exit'}
            variant="warning"
          />
        )}

        {/* Emergency Stop */}
        {!isStopped && (
          <ActionButton
            label="Emergency Stop"
            icon="🛑"
            onClick={() => setShowEmergencyConfirm(true)}
            loading={loadingAction === 'emergency-stop'}
            variant="danger"
          />
        )}
      </div>

      {isStopped && (
        <p className="text-sm text-gray-500">
          No active swarm. Use the launcher to start one.
        </p>
      )}

      {/* Emergency Stop Confirmation */}
      {showEmergencyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-red-800 rounded-xl p-6 max-w-sm mx-4 space-y-4">
            <h3 className="text-xl font-bold text-red-400">⚠ Emergency Stop</h3>
            <p className="text-sm text-gray-400">
              This will immediately halt all agents and cancel pending transactions. Open positions
              will NOT be automatically closed.
            </p>
            <p className="text-sm text-red-300 font-medium">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEmergencyConfirm(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyStop}
                disabled={loadingAction === 'emergency-stop'}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {loadingAction === 'emergency-stop' ? 'Stopping...' : 'Confirm Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────

function ActionButton({
  label,
  icon,
  onClick,
  loading,
  variant,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  loading: boolean;
  variant: 'success' | 'warning' | 'danger';
}) {
  const variantClasses = {
    success: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-600',
    warning: 'bg-amber-700 hover:bg-amber-600 border-amber-600',
    danger: 'bg-red-700 hover:bg-red-600 border-red-600',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <span>{icon}</span>
      )}
      {label}
    </button>
  );
}
