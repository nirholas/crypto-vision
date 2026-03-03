"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getWebSocket } from "@/lib/websocket";
import type {
  ConsolidationRequest,
  ConsolidationQuote,
  ConsolidationStatus,
  ConsolidationRouteStatus,
  ConsolidationUpdateEvent,
} from "@/lib/types";

// API functions - these will be implemented when backend is ready
// For now, they throw to indicate pending implementation
async function getConsolidationQuote(
  request: ConsolidationRequest
): Promise<ConsolidationQuote> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/consolidate/quote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to get quote" }));
    throw new Error(error.error || "Failed to get consolidation quote");
  }

  const data = await response.json();
  return data.quote;
}

async function executeConsolidation(quoteId: string, signature: string): Promise<{ consolidationId: string }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/consolidate/execute`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteId, signature }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to execute" }));
    throw new Error(error.error || "Failed to execute consolidation");
  }

  return response.json();
}

async function getConsolidationStatus(consolidationId: string): Promise<ConsolidationStatus> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/consolidate/${consolidationId}/status`
  );

  if (!response.ok) {
    throw new Error("Failed to get consolidation status");
  }

  return response.json();
}

// ============================================
// Consolidation Flow State
// ============================================

export type ConsolidationStep = "select" | "quote" | "review" | "execute" | "tracking" | "complete";

interface ConsolidationState {
  step: ConsolidationStep;
  sourceChains: number[];
  destinationChainId: number | null;
  destinationToken: string;
  quote: ConsolidationQuote | null;
  consolidationId: string | null;
  status: ConsolidationStatus | null;
  error: string | null;
}

const initialState: ConsolidationState = {
  step: "select",
  sourceChains: [],
  destinationChainId: null,
  destinationToken: "ETH",
  quote: null,
  consolidationId: null,
  status: null,
  error: null,
};

/**
 * Hook to manage the full consolidation flow
 * Handles state machine transitions from selection to completion
 */
export function useConsolidation() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConsolidationState>(initialState);

  // Update source chains
  const setSourceChains = useCallback((chains: number[]) => {
    setState((prev: ConsolidationState) => ({
      ...prev,
      sourceChains: chains,
      error: null,
    }));
  }, []);

  // Update destination
  const setDestination = useCallback((chainId: number, token: string) => {
    setState((prev: ConsolidationState) => ({
      ...prev,
      destinationChainId: chainId,
      destinationToken: token,
      error: null,
    }));
  }, []);

  // Get quote mutation
  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!address || state.sourceChains.length === 0 || !state.destinationChainId) {
        throw new Error("Missing required fields");
      }

      const request: ConsolidationRequest = {
        wallet: address,
        sourceChains: state.sourceChains,
        destinationChainId: state.destinationChainId,
        destinationToken: state.destinationToken,
      };

      return getConsolidationQuote(request);
    },
    onSuccess: (quote: ConsolidationQuote) => {
      setState((prev: ConsolidationState) => ({
        ...prev,
        quote,
        step: "review",
        error: null,
      }));
    },
    onError: (error: Error) => {
      setState((prev: ConsolidationState) => ({
        ...prev,
        error: error.message,
      }));
    },
  });

  // Execute consolidation mutation
  const executeMutation = useMutation({
    mutationFn: async (signature: string) => {
      if (!state.quote) {
        throw new Error("No quote available");
      }
      return executeConsolidation(state.quote.id, signature);
    },
    onSuccess: (result: { consolidationId: string }) => {
      setState((prev: ConsolidationState) => ({
        ...prev,
        consolidationId: result.consolidationId,
        step: "tracking",
        error: null,
      }));
    },
    onError: (error: Error) => {
      setState((prev: ConsolidationState) => ({
        ...prev,
        error: error.message,
      }));
    },
  });

  // Request quote
  const requestQuote = useCallback(() => {
    setState((prev: ConsolidationState) => ({ ...prev, step: "quote" }));
    quoteMutation.mutate();
  }, [quoteMutation]);

  // Execute with signature
  const execute = useCallback(
    (signature: string) => {
      setState((prev: ConsolidationState) => ({ ...prev, step: "execute" }));
      executeMutation.mutate(signature);
    },
    [executeMutation]
  );

  // Reset flow
  const reset = useCallback(() => {
    setState(initialState);
    queryClient.invalidateQueries({ queryKey: ["multiChainBalance"] });
  }, [queryClient]);

  // Go back one step
  const goBack = useCallback(() => {
    setState((prev: ConsolidationState) => {
      const stepOrder: ConsolidationStep[] = ["select", "quote", "review", "execute", "tracking", "complete"];
      const currentIndex = stepOrder.indexOf(prev.step);
      const prevStep = currentIndex > 0 ? stepOrder[currentIndex - 1] : prev.step;

      return {
        ...prev,
        step: prevStep,
        error: null,
      };
    });
  }, []);

  return {
    // State
    ...state,
    isQuoting: quoteMutation.isPending,
    isExecuting: executeMutation.isPending,

    // Actions
    setSourceChains,
    setDestination,
    requestQuote,
    execute,
    reset,
    goBack,
  };
}

// ============================================
// Consolidation Status Tracking
// ============================================

/**
 * Hook to track consolidation progress in real-time
 */
export function useConsolidationStatus(consolidationId: string | null) {
  const [routeStatuses, setRouteStatuses] = useState<Record<string, ConsolidationRouteStatus>>({});

  // Initial status fetch
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ["consolidationStatus", consolidationId],
    queryFn: () => {
      if (!consolidationId) throw new Error("No consolidation ID");
      return getConsolidationStatus(consolidationId);
    },
    enabled: !!consolidationId,
    refetchInterval: (query: { state: { data?: ConsolidationStatus } }) => {
      const data = query.state.data;
      // Stop polling when complete or failed
      if (data?.status === "completed" || data?.status === "failed") {
        return false;
      }
      return 5000; // Poll every 5 seconds
    },
  });

  // WebSocket updates
  useEffect(() => {
    if (!consolidationId) return;

    const ws = getWebSocket();

    const unsubscribe = ws.onConsolidationUpdate((event: ConsolidationUpdateEvent) => {
      if (event.consolidationId !== consolidationId) return;

      setRouteStatuses((prev: Record<string, ConsolidationRouteStatus>) => ({
        ...prev,
        [event.routeId]: {
          routeId: event.routeId,
          sourceChainId: 0, // Will be filled from initial status
          status: event.status,
          progress: event.progress,
          txHash: event.txHash,
        },
      }));

      // Refetch full status on significant changes
      if (event.status === "completed" || event.status === "failed") {
        refetch();
      }
    });

    // Subscribe to consolidation updates
    ws.subscribeConsolidation(consolidationId);

    return () => {
      unsubscribe();
      ws.unsubscribeConsolidation(consolidationId);
    };
  }, [consolidationId, refetch]);

  // Merge WebSocket updates with polled status
  const mergedStatus: ConsolidationStatus | undefined = status
    ? {
        ...status,
        routes: status.routes.map((route: ConsolidationRouteStatus) => ({
          ...route,
          ...routeStatuses[route.routeId],
        })),
      }
    : undefined;

  // Calculate overall progress
  const overallProgress =
    mergedStatus?.routes.reduce((sum: number, r: ConsolidationRouteStatus) => sum + r.progress, 0) ?? 0;
  const totalRoutes = mergedStatus?.routes.length ?? 1;
  const progressPercent = Math.round(overallProgress / totalRoutes);

  return {
    status: mergedStatus,
    isLoading,
    error,
    progressPercent,
    isComplete: mergedStatus?.status === "completed",
    isFailed: mergedStatus?.status === "failed",
    refetch,
  };
}

// ============================================
// Consolidation History
// ============================================

/**
 * Hook to fetch consolidation history for the connected wallet
 */
export function useConsolidationHistory() {
  const { address } = useAccount();

  return useQuery<ConsolidationStatus[], Error>({
    queryKey: ["consolidationHistory", address],
    queryFn: async () => {
      if (!address) throw new Error("Wallet not connected");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/consolidate/history?wallet=${address}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch consolidation history");
      }

      const data = await response.json();
      return data.consolidations;
    },
    enabled: !!address,
    staleTime: 60_000,
  });
}
