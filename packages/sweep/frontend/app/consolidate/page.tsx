"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { WalletConnect } from "@/components/WalletConnect";
import { ChainSelector } from "@/components/ChainSelector";
import { FeeBreakdown } from "@/components/FeeBreakdown";
import { useConsolidation, useConsolidationStatus } from "@/hooks/useConsolidation";
import { useMultiChainBalance, useConsolidationSuggestions } from "@/hooks/useMultiChainBalance";
import { SUPPORTED_CHAINS, getChainName } from "@/lib/chains";
import { OUTPUT_TOKEN_OPTIONS } from "@/lib/types";
import { ConsolidationSkeleton, StatCardSkeleton } from "@/components/Skeletons";

export default function ConsolidatePage() {
  const { isConnected } = useAccount();
  
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8">
            <span className="text-8xl">🔄</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Consolidate Assets</h1>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Connect your wallet to consolidate tokens from multiple chains into a single destination.
          </p>
          <WalletConnect />
        </div>
      </main>
    );
  }

  return <ConsolidationFlow />;
}

function ConsolidationFlow() {
  const {
    step,
    sourceChains,
    destinationChainId,
    destinationToken,
    quote,
    status,
    error,
    isQuoting,
    isExecuting,
    setSourceChains,
    setDestination,
    requestQuote,
    execute,
    reset,
    goBack,
  } = useConsolidation();

  const { data: balance, isLoading: isLoadingBalance } = useMultiChainBalance();
  const { suggestedSourceChains, suggestedDestination } = useConsolidationSuggestions();

  // Track signing state
  const [isSigning, setIsSigning] = useState(false);

  // Handle execute with signature
  const handleExecute = async () => {
    // In a real implementation, we'd get a signature from the wallet
    // For now, we simulate the signing flow
    setIsSigning(true);
    try {
      // Simulate signature request
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const mockSignature = "0x..."; // Would come from wallet
      execute(mockSignature);
    } catch (err) {
      console.error("Failed to sign:", err);
    } finally {
      setIsSigning(false);
    }
  };

  // Apply suggestions
  const applySuggestions = () => {
    if (suggestedSourceChains.length > 0) {
      setSourceChains(suggestedSourceChains.map((c) => c.chainId));
    }
    if (suggestedDestination) {
      setDestination(suggestedDestination.chainId, "ETH");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Consolidate Assets</h1>
            <p className="text-muted-foreground">
              Bring your tokens from multiple chains into a single destination
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[
              { id: "select", label: "Select Chains" },
              { id: "quote", label: "Get Quote" },
              { id: "review", label: "Review" },
              { id: "execute", label: "Execute" },
              { id: "tracking", label: "Track" },
            ].map((s, i, arr) => (
              <div key={s.id} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step === s.id || arr.findIndex((x) => x.id === step) > i
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
                      arr.findIndex((x) => x.id === step) > i ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Step Content */}
          {step === "select" && (
            <SelectChainsStep
              balance={balance}
              isLoading={isLoadingBalance}
              sourceChains={sourceChains}
              destinationChainId={destinationChainId}
              destinationToken={destinationToken}
              onSourceChainsChange={setSourceChains}
              onDestinationChange={setDestination}
              onContinue={requestQuote}
              onApplySuggestions={applySuggestions}
              hasSuggestions={suggestedSourceChains.length > 0}
            />
          )}

          {(step === "quote" || isQuoting) && (
            <div className="text-center py-12">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium">Getting best routes...</p>
              <p className="text-sm text-muted-foreground">
                Finding optimal bridges and swap paths
              </p>
            </div>
          )}

          {step === "review" && quote && (
            <ReviewStep
              quote={quote}
              onBack={goBack}
              onExecute={handleExecute}
              isExecuting={isExecuting || isSigning}
            />
          )}

          {(step === "execute" || step === "tracking") && (
            <TrackingStep
              consolidationId={status?.id || null}
              onReset={reset}
            />
          )}

          {step === "complete" && (
            <CompleteStep status={status} onReset={reset} />
          )}
        </div>
      </div>
    </main>
  );
}

// ============================================
// Step Components
// ============================================

interface SelectChainsStepProps {
  balance: ReturnType<typeof useMultiChainBalance>["data"];
  isLoading: boolean;
  sourceChains: number[];
  destinationChainId: number | null;
  destinationToken: string;
  onSourceChainsChange: (chains: number[]) => void;
  onDestinationChange: (chainId: number, token: string) => void;
  onContinue: () => void;
  onApplySuggestions: () => void;
  hasSuggestions: boolean;
}

function SelectChainsStep({
  balance,
  isLoading,
  sourceChains,
  destinationChainId,
  destinationToken,
  onSourceChainsChange,
  onDestinationChange,
  onContinue,
  onApplySuggestions,
  hasSuggestions,
}: SelectChainsStepProps) {
  // Available chains for destination (excluding source chains)
  const availableDestinations = SUPPORTED_CHAINS.filter(
    (c) => !sourceChains.includes(c.id)
  );

  // Calculate total value from selected source chains
  const selectedValue = useMemo(() => {
    if (!balance) return 0;
    return balance.chainBreakdown
      .filter((c) => sourceChains.includes(c.chainId))
      .reduce((sum, c) => sum + c.totalValueUsd, 0);
  }, [balance, sourceChains]);

  const canContinue = sourceChains.length > 0 && destinationChainId !== null;

  return (
    <div className="space-y-6">
      {/* Balance Overview */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : balance ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border p-6">
            <p className="text-sm text-muted-foreground">Total Across Chains</p>
            <p className="text-2xl font-bold">${balance.totalValueUsd.toFixed(2)}</p>
          </div>
          <div className="bg-card rounded-xl border p-6">
            <p className="text-sm text-muted-foreground">Chains with Balance</p>
            <p className="text-2xl font-bold">{balance.chainBreakdown.length}</p>
          </div>
          <div className="bg-card rounded-xl border p-6">
            <p className="text-sm text-muted-foreground">Selected Value</p>
            <p className="text-2xl font-bold text-primary">${selectedValue.toFixed(2)}</p>
          </div>
        </div>
      ) : null}

      {/* Suggestion Banner */}
      {hasSuggestions && sourceChains.length === 0 && (
        <button
          onClick={onApplySuggestions}
          className="w-full p-4 bg-primary/10 border border-primary/20 rounded-lg text-left hover:bg-primary/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="font-medium">Smart Suggestion Available</p>
              <p className="text-sm text-muted-foreground">
                We've detected a good consolidation opportunity. Click to apply.
              </p>
            </div>
          </div>
        </button>
      )}

      {/* Source Chains */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Select Source Chains</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Choose which chains you want to consolidate from
        </p>
        <ChainSelector
          selectedChains={sourceChains}
          onChainsChange={onSourceChainsChange}
        />
        
        {/* Chain balances */}
        {balance && balance.chainBreakdown.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Your balances:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {balance.chainBreakdown.map((chain) => (
                <div
                  key={chain.chainId}
                  className={`p-2 rounded text-sm ${
                    sourceChains.includes(chain.chainId)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/50"
                  }`}
                >
                  <span className="font-medium">{chain.chainName}:</span>{" "}
                  ${chain.totalValueUsd.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Destination */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Choose Destination</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Where do you want your consolidated assets?
        </p>

        {/* Chain Selection */}
        <div className="flex flex-wrap gap-3 mb-6">
          {availableDestinations.map((chain) => (
            <button
              key={chain.id}
              onClick={() => onDestinationChange(chain.id, destinationToken)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                destinationChainId === chain.id
                  ? "bg-primary/10 border-primary text-foreground"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <span className="text-xl">{chain.icon}</span>
              <span className="font-medium">{chain.name}</span>
            </button>
          ))}
        </div>

        {/* Token Selection */}
        {destinationChainId && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Output token:</p>
            <div className="flex flex-wrap gap-2">
              {OUTPUT_TOKEN_OPTIONS.map((token) => (
                <button
                  key={token.symbol}
                  onClick={() => onDestinationChange(destinationChainId, token.symbol)}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    destinationToken === token.symbol
                      ? "bg-primary/10 border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <button
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sourceChains.length === 0
          ? "Select source chains"
          : destinationChainId === null
            ? "Select destination"
            : `Get Quote for ${sourceChains.length} chain${sourceChains.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}

interface ReviewStepProps {
  quote: NonNullable<ReturnType<typeof useConsolidation>["quote"]>;
  onBack: () => void;
  onExecute: () => void;
  isExecuting: boolean;
}

function ReviewStep({ quote, onBack, onExecute, isExecuting }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      {/* Routes */}
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Bridge Routes</h2>
        <div className="space-y-3">
          {quote.routes.map((route) => (
            <div
              key={route.id}
              className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{getChainName(route.sourceChainId)}</span>
              </div>
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="h-0.5 w-full max-w-[100px] bg-border" />
                <span className="px-2 text-xs bg-background">{route.bridge}</span>
                <div className="h-0.5 w-full max-w-[100px] bg-border" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{getChainName(route.destinationChainId)}</span>
              </div>
              <div className="text-right">
                <p className="font-medium">${route.fee.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  ~{route.estimatedTimeMinutes}m
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl border p-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Input</p>
            <p className="text-2xl font-bold">${quote.totalInputUsd.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Estimated Output</p>
            <p className="text-2xl font-bold text-green-500">
              ${quote.estimatedOutputUsd.toFixed(2)}
            </p>
          </div>
        </div>

        <FeeBreakdown
          consolidationFees={quote.totalFees}
          totalInputUsd={quote.totalInputUsd}
        />

        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon />
          <span>Estimated time: ~{quote.estimatedTimeMinutes} minutes</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          disabled={isExecuting}
          className="flex-1 py-4 border border-border rounded-xl font-medium hover:bg-muted transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onExecute}
          disabled={isExecuting}
          className="flex-1 py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isExecuting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              {isExecuting ? "Signing..." : "Executing..."}
            </span>
          ) : (
            "Confirm & Execute"
          )}
        </button>
      </div>
    </div>
  );
}

interface TrackingStepProps {
  consolidationId: string | null;
  onReset: () => void;
}

function TrackingStep({ consolidationId, onReset }: TrackingStepProps) {
  const { status, progressPercent, isComplete, isFailed } = useConsolidationStatus(consolidationId);

  if (!status) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg font-medium">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isComplete
              ? "Consolidation Complete! 🎉"
              : isFailed
                ? "Consolidation Failed"
                : "Consolidating..."}
          </h2>
          <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-6">
          <div
            className={`h-full transition-all duration-500 ${
              isFailed ? "bg-destructive" : isComplete ? "bg-green-500" : "bg-primary"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Route Status */}
        <div className="space-y-3">
          {status.routes.map((route) => (
            <div
              key={route.routeId}
              className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center">
                {route.status === "completed" ? (
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckIcon className="w-4 h-4 text-green-500" />
                  </div>
                ) : route.status === "failed" ? (
                  <div className="w-8 h-8 bg-destructive/20 rounded-full flex items-center justify-center">
                    <XIcon className="w-4 h-4 text-destructive" />
                  </div>
                ) : (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{getChainName(route.sourceChainId)}</p>
                <p className="text-sm text-muted-foreground capitalize">{route.status}</p>
              </div>
              {route.progress < 100 && route.status !== "failed" && (
                <span className="text-sm text-muted-foreground">{route.progress}%</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      {(isComplete || isFailed) && (
        <button
          onClick={onReset}
          className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
        >
          {isComplete ? "Start New Consolidation" : "Try Again"}
        </button>
      )}
    </div>
  );
}

interface CompleteStepProps {
  status: ReturnType<typeof useConsolidation>["status"];
  onReset: () => void;
}

function CompleteStep({ status, onReset }: CompleteStepProps) {
  return (
    <div className="text-center py-12">
      <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckIcon className="w-12 h-12 text-green-500" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Consolidation Complete!</h2>
      <p className="text-muted-foreground mb-8">
        Your assets have been successfully consolidated.
      </p>
      <button
        onClick={onReset}
        className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
      >
        Start New Consolidation
      </button>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
