"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { executeSweep, getSweepStatus, subscribeSweepStatus } from "@/lib/api";
import type {
  ExecuteSweepRequest,
  ExecuteSweepResponse,
  SweepStatus,
} from "@/lib/types";

/**
 * Hook to execute a sweep
 */
export function useSweepExecute() {
  const queryClient = useQueryClient();
  const [sweepId, setSweepId] = useState<string | null>(null);

  const mutation = useMutation<ExecuteSweepResponse, Error, ExecuteSweepRequest>({
    mutationFn: executeSweep,
    onSuccess: (data) => {
      if (data.success && data.sweepId) {
        setSweepId(data.sweepId);
        // Invalidate dust tokens to refresh after sweep
        queryClient.invalidateQueries({ queryKey: ["dustTokens"] });
      }
    },
  });

  const reset = useCallback(() => {
    setSweepId(null);
    mutation.reset();
  }, [mutation]);

  return {
    execute: mutation.mutate,
    executeAsync: mutation.mutateAsync,
    sweepId,
    isLoading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset,
  };
}

/**
 * Hook to poll sweep status
 */
export function useSweepStatus(sweepId: string | null) {
  return useQuery<SweepStatus, Error>({
    queryKey: ["sweepStatus", sweepId],
    queryFn: async () => {
      if (!sweepId) throw new Error("No sweep ID");
      return getSweepStatus(sweepId);
    },
    enabled: !!sweepId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Stop polling when sweep is complete
      if (data?.status === "confirmed" || data?.status === "failed") {
        return false;
      }
      return 5000; // Poll every 5 seconds
    },
    retry: 3,
  });
}

/**
 * Hook to subscribe to real-time sweep updates via SSE
 */
export function useSweepStream(
  sweepId: string | null,
  onStatusUpdate?: (status: SweepStatus) => void
) {
  const [status, setStatus] = useState<SweepStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const subscribe = useCallback(() => {
    if (!sweepId) return () => {};

    setIsConnected(true);
    setError(null);

    const cleanup = subscribeSweepStatus(
      sweepId,
      (newStatus) => {
        setStatus(newStatus);
        onStatusUpdate?.(newStatus);

        if (newStatus.status === "confirmed" || newStatus.status === "failed") {
          setIsConnected(false);
        }
      },
      (err) => {
        setError(err);
        setIsConnected(false);
      }
    );

    return cleanup;
  }, [sweepId, onStatusUpdate]);

  return {
    status,
    error,
    isConnected,
    subscribe,
  };
}

/**
 * Combined hook for full sweep execution flow
 */
export function useSweep() {
  const queryClient = useQueryClient();
  const { execute, executeAsync, sweepId, isLoading, error, reset } = useSweepExecute();
  const { data: status } = useSweepStatus(sweepId);

  const isComplete = status?.status === "confirmed" || status?.status === "failed";
  const isSuccess = status?.status === "confirmed";
  const isFailed = status?.status === "failed";

  const startNewSweep = useCallback(() => {
    reset();
    queryClient.invalidateQueries({ queryKey: ["dustTokens"] });
    queryClient.invalidateQueries({ queryKey: ["walletSummary"] });
  }, [reset, queryClient]);

  return {
    // Execution
    execute,
    executeAsync,
    isLoading,
    error,

    // Status
    sweepId,
    status,
    isComplete,
    isSuccess,
    isFailed,

    // Actions
    reset,
    startNewSweep,
  };
}
