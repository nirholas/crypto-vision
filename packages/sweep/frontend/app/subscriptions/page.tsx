"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { WalletConnect } from "@/components/WalletConnect";
import { ChainSelector } from "@/components/ChainSelector";
import {
  useSubscriptions,
  useSubscriptionStats,
  useCreateSubscription,
  useToggleSubscription,
  useCancelSubscription,
  useSubscriptionRuns,
  formatNextRun,
  formatFrequency,
} from "@/hooks/useSubscriptions";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { OUTPUT_TOKEN_OPTIONS } from "@/lib/types";
import type { Subscription, SubscriptionFrequency, SubscriptionRun } from "@/lib/types";
import { SubscriptionListSkeleton, StatCardSkeleton } from "@/components/Skeletons";

export default function SubscriptionsPage() {
  const { isConnected } = useAccount();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<string | null>(null);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8">
            <span className="text-8xl">⏰</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Auto-Sweep Subscriptions</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Set up automatic sweeps to keep your wallets clean. Never worry about dust again!
          </p>
          <WalletConnect />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Subscriptions</h1>
              <p className="text-muted-foreground">
                Manage your automatic dust sweep schedules
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              + New Subscription
            </button>
          </div>

          {/* Stats */}
          <SubscriptionStatsSection />

          {/* Subscriptions List */}
          <SubscriptionsList
            onSelect={setSelectedSubscription}
            selectedId={selectedSubscription}
          />

          {/* Selected Subscription Detail */}
          {selectedSubscription && (
            <SubscriptionDetail
              subscriptionId={selectedSubscription}
              onClose={() => setSelectedSubscription(null)}
            />
          )}

          {/* Create Modal */}
          {showCreateModal && (
            <CreateSubscriptionModal onClose={() => setShowCreateModal(false)} />
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================
// Stats Section
// ============================================

function SubscriptionStatsSection() {
  const { isLoading, activeCount, totalSweeps, totalValueSwept, totalGasSaved } =
    useSubscriptionStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <div className="bg-card rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Active Subscriptions</p>
        <p className="text-2xl font-bold">{activeCount}</p>
      </div>
      <div className="bg-card rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Total Sweeps</p>
        <p className="text-2xl font-bold">{totalSweeps}</p>
      </div>
      <div className="bg-card rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Value Swept</p>
        <p className="text-2xl font-bold">${totalValueSwept.toFixed(2)}</p>
      </div>
      <div className="bg-card rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Gas Saved</p>
        <p className="text-2xl font-bold text-green-500">${totalGasSaved.toFixed(2)}</p>
      </div>
    </div>
  );
}

// ============================================
// Subscriptions List
// ============================================

interface SubscriptionsListProps {
  onSelect: (id: string) => void;
  selectedId: string | null;
}

function SubscriptionsList({ onSelect, selectedId }: SubscriptionsListProps) {
  const { data: subscriptions, isLoading, error, refetch } = useSubscriptions();
  const { toggle, isPending: isToggling } = useToggleSubscription();
  const { cancel, isPending: isCancelling } = useCancelSubscription();

  if (isLoading) {
    return <SubscriptionListSkeleton />;
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border p-8 text-center">
        <p className="text-destructive mb-2">Failed to load subscriptions</p>
        <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-12 text-center">
        <span className="text-6xl mb-4 block">📭</span>
        <h3 className="text-xl font-semibold mb-2">No Subscriptions Yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first auto-sweep subscription to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {subscriptions.map((subscription) => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          isSelected={selectedId === subscription.id}
          onSelect={() => onSelect(subscription.id)}
          onToggle={(action) => toggle({ subscriptionId: subscription.id, action })}
          onCancel={() => cancel(subscription.id)}
          isToggling={isToggling}
          isCancelling={isCancelling}
        />
      ))}
    </div>
  );
}

// ============================================
// Subscription Card
// ============================================

interface SubscriptionCardProps {
  subscription: Subscription;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: (action: "pause" | "resume") => void;
  onCancel: () => void;
  isToggling: boolean;
  isCancelling: boolean;
}

function SubscriptionCard({
  subscription,
  isSelected,
  onSelect,
  onToggle,
  onCancel,
  isToggling,
  isCancelling,
}: SubscriptionCardProps) {
  const statusColors = {
    active: "bg-green-500/20 text-green-600 dark:text-green-400",
    paused: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/20 text-destructive",
  };

  const chainNames = subscription.chainIds
    .slice(0, 3)
    .map((id) => SUPPORTED_CHAINS.find((c) => c.id === id)?.name || `Chain ${id}`)
    .join(", ");
  const moreChains = subscription.chainIds.length > 3 ? ` +${subscription.chainIds.length - 3}` : "";

  return (
    <div
      className={`bg-card rounded-xl border p-6 transition-all ${
        isSelected ? "ring-2 ring-primary" : "hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <button onClick={onSelect} className="flex items-center gap-3 text-left">
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
            <span className="text-2xl">🧹</span>
          </div>
          <div>
            <h3 className="font-semibold">
              {chainNames}
              {moreChains}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatFrequency(subscription.frequency)} • Min ${subscription.minDustValue}
            </p>
          </div>
        </button>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[subscription.status]}`}>
          {subscription.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div>
          <p className="text-muted-foreground">Next Run</p>
          <p className="font-medium">{formatNextRun(subscription.nextRun)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total Sweeps</p>
          <p className="font-medium">{subscription.stats.totalSweeps}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Output</p>
          <p className="font-medium">{subscription.outputToken}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSelect}
          className="flex-1 py-2 bg-secondary rounded-lg font-medium hover:bg-secondary/80 transition-colors"
        >
          View Details
        </button>
        {subscription.status === "active" ? (
          <button
            onClick={() => onToggle("pause")}
            disabled={isToggling}
            className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            Pause
          </button>
        ) : subscription.status === "paused" ? (
          <button
            onClick={() => onToggle("resume")}
            disabled={isToggling}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Resume
          </button>
        ) : null}
        {(subscription.status === "active" || subscription.status === "paused") && (
          <button
            onClick={onCancel}
            disabled={isCancelling}
            className="px-4 py-2 text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Subscription Detail Panel
// ============================================

interface SubscriptionDetailProps {
  subscriptionId: string;
  onClose: () => void;
}

function SubscriptionDetail({ subscriptionId, onClose }: SubscriptionDetailProps) {
  const { data: runs, isLoading } = useSubscriptionRuns(subscriptionId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Subscription History</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : runs && runs.length > 0 ? (
            <div className="space-y-3">
              {runs.map((run) => (
                <RunHistoryItem key={run.id} run={run} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No runs yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RunHistoryItem({ run }: { run: SubscriptionRun }) {
  const statusColors = {
    success: "text-green-500",
    failed: "text-destructive",
    partial: "text-yellow-500",
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          run.status === "success"
            ? "bg-green-500/20"
            : run.status === "failed"
              ? "bg-destructive/20"
              : "bg-yellow-500/20"
        }`}
      >
        {run.status === "success" ? (
          <CheckIcon className="w-5 h-5 text-green-500" />
        ) : run.status === "failed" ? (
          <XIcon className="w-5 h-5 text-destructive" />
        ) : (
          <WarningIcon className="w-5 h-5 text-yellow-500" />
        )}
      </div>
      <div className="flex-1">
        <p className="font-medium">
          Swept {run.tokensSwept} token{run.tokensSwept !== 1 ? "s" : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          {new Date(run.executedAt).toLocaleString()}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-medium ${statusColors[run.status]}`}>
          ${run.valueUsd.toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground">
          Saved ${run.gasSaved.toFixed(2)}
        </p>
      </div>
    </div>
  );
}

// ============================================
// Create Subscription Modal
// ============================================

interface CreateSubscriptionModalProps {
  onClose: () => void;
}

function CreateSubscriptionModal({ onClose }: CreateSubscriptionModalProps) {
  const [step, setStep] = useState<"chains" | "settings" | "confirm">("chains");
  const [chainIds, setChainIds] = useState<number[]>([]);
  const [frequency, setFrequency] = useState<SubscriptionFrequency>("weekly");
  const [minDustValue, setMinDustValue] = useState(1);
  const [outputToken, setOutputToken] = useState("ETH");
  const [outputChainId, setOutputChainId] = useState(1);
  const [thresholdValue, setThresholdValue] = useState(10);

  const { create, isSigningPermission, isCreating, error, isSuccess } = useCreateSubscription();

  const handleCreate = async () => {
    await create({
      chainIds,
      minDustValue,
      outputToken,
      outputChainId,
      frequency,
      thresholdValueUsd: frequency === "on_threshold" ? thresholdValue : undefined,
    });
  };

  if (isSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-card rounded-xl border max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Subscription Created!</h2>
          <p className="text-muted-foreground mb-6">
            Your auto-sweep subscription is now active.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Create Subscription</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {["chains", "settings", "confirm"].map((s, i, arr) => (
              <div key={s} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step === s || arr.indexOf(step) > i
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div
                    className={`w-8 h-0.5 ${
                      arr.indexOf(step) > i ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error.message}
            </div>
          )}

          {/* Step Content */}
          {step === "chains" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Select Chains to Monitor</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose which chains to automatically sweep dust from
                </p>
                <ChainSelector selectedChains={chainIds} onChainsChange={setChainIds} />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep("settings")}
                  disabled={chainIds.length === 0}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === "settings" && (
            <div className="space-y-6">
              {/* Frequency */}
              <div>
                <h3 className="font-medium mb-2">Sweep Frequency</h3>
                <div className="grid grid-cols-2 gap-3">
                  {(["daily", "weekly", "monthly", "on_threshold"] as const).map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFrequency(freq)}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        frequency === freq
                          ? "bg-primary/10 border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-medium">{formatFrequency(freq)}</p>
                      <p className="text-xs text-muted-foreground">
                        {freq === "daily" && "Every 24 hours"}
                        {freq === "weekly" && "Every 7 days"}
                        {freq === "monthly" && "Every 30 days"}
                        {freq === "on_threshold" && "When dust reaches threshold"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Threshold (if on_threshold) */}
              {frequency === "on_threshold" && (
                <div>
                  <label className="block font-medium mb-2">
                    Threshold Value (USD)
                  </label>
                  <input
                    type="number"
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                    min={1}
                  />
                </div>
              )}

              {/* Min Dust Value */}
              <div>
                <label className="block font-medium mb-2">Minimum Token Value (USD)</label>
                <input
                  type="number"
                  value={minDustValue}
                  onChange={(e) => setMinDustValue(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background"
                  step={0.1}
                  min={0.1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Only sweep tokens worth at least this amount
                </p>
              </div>

              {/* Output Token */}
              <div>
                <label className="block font-medium mb-2">Output Token</label>
                <div className="flex flex-wrap gap-2">
                  {OUTPUT_TOKEN_OPTIONS.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => setOutputToken(token.symbol)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        outputToken === token.symbol
                          ? "bg-primary/10 border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {token.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Chain */}
              <div>
                <label className="block font-medium mb-2">Output Chain</label>
                <div className="flex flex-wrap gap-2">
                  {SUPPORTED_CHAINS.slice(0, 4).map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => setOutputChainId(chain.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                        outputChainId === chain.id
                          ? "bg-primary/10 border-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span>{chain.icon}</span>
                      <span>{chain.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep("chains")}
                  className="px-6 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep("confirm")}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="font-semibold mb-4">Subscription Summary</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Chains</dt>
                    <dd className="font-medium">
                      {chainIds.length} chain{chainIds.length !== 1 ? "s" : ""}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Frequency</dt>
                    <dd className="font-medium">{formatFrequency(frequency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Min Token Value</dt>
                    <dd className="font-medium">${minDustValue}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Output</dt>
                    <dd className="font-medium">
                      {outputToken} on {SUPPORTED_CHAINS.find((c) => c.id === outputChainId)?.name}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex gap-3">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <p className="font-medium">Spend Permission Required</p>
                    <p className="text-sm text-muted-foreground">
                      You'll sign a message to allow Sweep to execute sweeps on your behalf.
                      This can be revoked at any time.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep("settings")}
                  disabled={isSigningPermission || isCreating}
                  className="px-6 py-2 border border-border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isSigningPermission || isCreating}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isSigningPermission ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Sign Permission...
                    </span>
                  ) : isCreating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Subscription"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function XIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WarningIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}
