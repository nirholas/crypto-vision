"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSignTypedData } from "wagmi";
import type {
  Subscription,
  SubscriptionFrequency,
  SubscriptionRun,
  CreateSubscriptionRequest,
  SpendPermission,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ============================================
// API Functions
// ============================================

async function fetchSubscriptions(wallet: string): Promise<Subscription[]> {
  const response = await fetch(`${API_BASE}/api/subscriptions?wallet=${wallet}`);
  if (!response.ok) {
    throw new Error("Failed to fetch subscriptions");
  }
  const data = await response.json();
  return data.subscriptions;
}

async function fetchSubscription(subscriptionId: string): Promise<Subscription> {
  const response = await fetch(`${API_BASE}/api/subscriptions/${subscriptionId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch subscription");
  }
  return response.json();
}

async function fetchSubscriptionRuns(subscriptionId: string): Promise<SubscriptionRun[]> {
  const response = await fetch(`${API_BASE}/api/subscriptions/${subscriptionId}/runs`);
  if (!response.ok) {
    throw new Error("Failed to fetch subscription runs");
  }
  const data = await response.json();
  return data.runs;
}

async function createSubscription(
  wallet: string,
  request: CreateSubscriptionRequest,
  spendPermission: SpendPermission
): Promise<Subscription> {
  const response = await fetch(`${API_BASE}/api/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      ...request,
      spendPermission,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Failed to create" }));
    throw new Error(error.error || "Failed to create subscription");
  }

  return response.json();
}

async function updateSubscriptionStatus(
  subscriptionId: string,
  status: "active" | "paused"
): Promise<Subscription> {
  const response = await fetch(`${API_BASE}/api/subscriptions/${subscriptionId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Failed to update subscription");
  }

  return response.json();
}

async function cancelSubscription(subscriptionId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to cancel subscription");
  }
}

// ============================================
// Hooks
// ============================================

/**
 * Hook to fetch all subscriptions for the connected wallet
 */
export function useSubscriptions() {
  const { address } = useAccount();

  return useQuery<Subscription[], Error>({
    queryKey: ["subscriptions", address],
    queryFn: () => {
      if (!address) throw new Error("Wallet not connected");
      return fetchSubscriptions(address);
    },
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Hook to fetch a single subscription by ID
 */
export function useSubscription(subscriptionId: string | null) {
  return useQuery<Subscription, Error>({
    queryKey: ["subscription", subscriptionId],
    queryFn: () => {
      if (!subscriptionId) throw new Error("No subscription ID");
      return fetchSubscription(subscriptionId);
    },
    enabled: !!subscriptionId,
    staleTime: 30_000,
  });
}

/**
 * Hook to fetch run history for a subscription
 */
export function useSubscriptionRuns(subscriptionId: string | null) {
  return useQuery<SubscriptionRun[], Error>({
    queryKey: ["subscriptionRuns", subscriptionId],
    queryFn: () => {
      if (!subscriptionId) throw new Error("No subscription ID");
      return fetchSubscriptionRuns(subscriptionId);
    },
    enabled: !!subscriptionId,
    staleTime: 60_000,
  });
}

/**
 * Hook to create a new subscription with spend permission signing
 */
export function useCreateSubscription() {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { signTypedDataAsync } = useSignTypedData();

  const [isSigningPermission, setIsSigningPermission] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({
      request,
      spendPermission,
    }: {
      request: CreateSubscriptionRequest;
      spendPermission: SpendPermission;
    }) => {
      if (!address) throw new Error("Wallet not connected");
      return createSubscription(address, request, spendPermission);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });
    },
  });

  /**
   * Create subscription with EIP-7715 spend permission
   */
  const create = useCallback(
    async (request: CreateSubscriptionRequest) => {
      if (!address) throw new Error("Wallet not connected");

      setIsSigningPermission(true);

      try {
        // Build the spend permission
        const spendPermission: SpendPermission = {
          token: request.outputToken,
          allowance: "1000000000000000000000", // 1000 tokens max
          period: 86400 * 30, // 30 days
          start: Math.floor(Date.now() / 1000),
          end: Math.floor(Date.now() / 1000) + 86400 * 365, // 1 year
          salt: `0x${Date.now().toString(16).padStart(64, "0")}`,
          extraData: "0x",
        };

        // Sign the spend permission (EIP-712)
        const signature = await signTypedDataAsync({
          domain: {
            name: "Sweep",
            version: "1",
            chainId: request.outputChainId,
            verifyingContract: "0x0000000000000000000000000000000000000000", // TODO: Replace with deployed Sweep contract address before mainnet launch
          },
          types: {
            SpendPermission: [
              { name: "token", type: "address" },
              { name: "allowance", type: "uint256" },
              { name: "period", type: "uint48" },
              { name: "start", type: "uint48" },
              { name: "end", type: "uint48" },
              { name: "salt", type: "bytes32" },
              { name: "extraData", type: "bytes" },
            ],
          },
          primaryType: "SpendPermission",
          message: {
            token: spendPermission.token as `0x${string}`,
            allowance: BigInt(spendPermission.allowance),
            period: spendPermission.period,
            start: spendPermission.start,
            end: spendPermission.end,
            salt: spendPermission.salt as `0x${string}`,
            extraData: spendPermission.extraData as `0x${string}`,
          },
        });

        spendPermission.signature = signature;

        // Create the subscription
        return mutation.mutateAsync({ request, spendPermission });
      } finally {
        setIsSigningPermission(false);
      }
    },
    [address, mutation, signTypedDataAsync]
  );

  return {
    create,
    isSigningPermission,
    isCreating: mutation.isPending,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
    data: mutation.data,
    reset: mutation.reset,
  };
}

/**
 * Hook to pause/resume a subscription
 */
export function useToggleSubscription() {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const mutation = useMutation({
    mutationFn: async ({
      subscriptionId,
      action,
    }: {
      subscriptionId: string;
      action: "pause" | "resume";
    }) => {
      return updateSubscriptionStatus(
        subscriptionId,
        action === "pause" ? "paused" : "active"
      );
    },
    onSuccess: (_: Subscription, { subscriptionId }: { subscriptionId: string; action: "pause" | "resume" }) => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });
      queryClient.invalidateQueries({ queryKey: ["subscription", subscriptionId] });
    },
  });

  return {
    toggle: mutation.mutate,
    toggleAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to cancel a subscription
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const mutation = useMutation({
    mutationFn: (subscriptionId: string) => cancelSubscription(subscriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });
    },
  });

  return {
    cancel: mutation.mutate,
    cancelAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to get subscription summary stats
 */
export function useSubscriptionStats() {
  const { data: subscriptions, isLoading } = useSubscriptions();

  if (!subscriptions || isLoading) {
    return {
      isLoading,
      activeCount: 0,
      totalSweeps: 0,
      totalValueSwept: 0,
      totalGasSaved: 0,
    };
  }

  return {
    isLoading,
    activeCount: subscriptions.filter((s: Subscription) => s.status === "active").length,
    totalSweeps: subscriptions.reduce((sum: number, s: Subscription) => sum + s.stats.totalSweeps, 0),
    totalValueSwept: subscriptions.reduce((sum: number, s: Subscription) => sum + s.stats.totalValueUsd, 0),
    totalGasSaved: subscriptions.reduce((sum: number, s: Subscription) => sum + s.stats.totalGasSaved, 0),
  };
}

/**
 * Format next run time for display
 */
export function formatNextRun(nextRun: number | undefined): string {
  if (!nextRun) return "Not scheduled";

  const now = Date.now();
  const diff = nextRun - now;

  if (diff < 0) return "Overdue";
  if (diff < 60_000) return "Less than a minute";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} minutes`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} hours`;
  return `${Math.floor(diff / 86400_000)} days`;
}

/**
 * Format frequency for display
 */
export function formatFrequency(frequency: SubscriptionFrequency): string {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "on_threshold":
      return "When threshold reached";
    default:
      return frequency;
  }
}
