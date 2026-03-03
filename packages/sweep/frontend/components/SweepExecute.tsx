"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";
import type { SweepQuote, SweepStatus } from "@/lib/types";
import { executeSweep, getSweepStatus } from "@/lib/api";

interface SweepExecuteProps {
  quote: SweepQuote;
  onComplete: (status: SweepStatus) => void;
  onBack: () => void;
}

type ExecuteStep = "idle" | "signing" | "authenticating" | "paying" | "executing" | "done" | "error";

export function SweepExecute({ quote, onComplete, onBack }: SweepExecuteProps) {
  const { address, chain } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [step, setStep] = useState<ExecuteStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleExecute = async () => {
    if (!address || !chain) return;

    try {
      setError(null);
      setStep("signing");
      setProgress(10);

      // Step 1: Create and sign SIWE message for authentication
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address,
        statement: `Sign this message to authorize Sweep to sweep ${quote.inputTokens.length} tokens.`,
        uri: window.location.origin,
        version: "1",
        chainId: chain.id,
        nonce: generateNonce(),
      });

      const message = siweMessage.prepareMessage();
      const signature = await signMessageAsync({ message });

      setStep("authenticating");
      setProgress(30);

      // Step 2: Execute sweep via API
      setStep("executing");
      setProgress(50);

      const result = await executeSweep({
        quoteId: quote.id,
        wallet: address,
        signature,
        message,
      });

      if (!result.success) {
        throw new Error(result.error || "Sweep failed");
      }

      // Step 3: Poll for status
      setProgress(70);
      const finalStatus = await pollForCompletion(result.sweepId);

      setStep("done");
      setProgress(100);
      onComplete(finalStatus);
    } catch (err: any) {
      console.error("Sweep error:", err);
      setStep("error");
      setError(err.message || "Failed to execute sweep");
    }
  };

  const pollForCompletion = async (sweepId: string): Promise<SweepStatus> => {
    const maxAttempts = 60; // 5 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await getSweepStatus(sweepId);
      
      if (status.status === "confirmed" || status.status === "failed") {
        return status;
      }

      // Update progress based on status
      if (status.status === "submitted") {
        setProgress(80);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error("Sweep timed out");
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-6 text-center">
          {step === "idle" && "Ready to Sweep"}
          {step === "signing" && "Sign Message"}
          {step === "authenticating" && "Authenticating..."}
          {step === "paying" && "Processing Payment..."}
          {step === "executing" && "Executing Sweep..."}
          {step === "done" && "Sweep Complete!"}
          {step === "error" && "Sweep Failed"}
        </h2>

        {/* Progress Steps */}
        <div className="space-y-4 mb-8">
          <StepIndicator
            step={1}
            label="Sign Authorization"
            status={getStepStatus(step, "signing")}
          />
          <StepIndicator
            step={2}
            label="Authenticate"
            status={getStepStatus(step, "authenticating")}
          />
          <StepIndicator
            step={3}
            label="Execute Swap"
            status={getStepStatus(step, "executing")}
          />
          <StepIndicator
            step={4}
            label="Confirm Transaction"
            status={getStepStatus(step, "done")}
          />
        </div>

        {/* Progress Bar */}
        {step !== "idle" && step !== "error" && (
          <div className="mb-6">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {progress}% complete
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg mb-6">
            <p className="text-destructive text-center">{error}</p>
          </div>
        )}

        {/* Instructions */}
        {step === "idle" && (
          <div className="text-center text-muted-foreground mb-6">
            <p>Click the button below to start the sweep process.</p>
            <p className="text-sm mt-2">
              You&apos;ll be asked to sign a message to authorize the transaction.
            </p>
          </div>
        )}

        {step === "signing" && (
          <div className="text-center text-muted-foreground mb-6">
            <p>Please sign the message in your wallet to continue.</p>
            <p className="text-sm mt-2">
              This verifies your ownership of the wallet.
            </p>
          </div>
        )}

        {step === "executing" && (
          <div className="text-center text-muted-foreground mb-6">
            <p>Your sweep is being processed...</p>
            <p className="text-sm mt-2">
              This may take a few minutes depending on network conditions.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          {(step === "idle" || step === "error") && (
            <>
              <button
                onClick={onBack}
                className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleExecute}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                {step === "error" ? "Try Again" : "Start Sweep"}
              </button>
            </>
          )}

          {step !== "idle" && step !== "error" && step !== "done" && (
            <div className="w-full flex justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fee Reminder */}
      <div className="bg-muted/50 rounded-xl p-4 text-center text-sm text-muted-foreground">
        <p>
          Total fees: ${quote.fees.total.toFixed(2)} • Gas: Sponsored (free)
        </p>
      </div>
    </div>
  );
}

function StepIndicator({
  step,
  label,
  status,
}: {
  step: number;
  label: string;
  status: "pending" | "active" | "complete" | "error";
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          status === "complete"
            ? "bg-green-500 text-white"
            : status === "active"
            ? "bg-primary text-primary-foreground animate-pulse"
            : status === "error"
            ? "bg-destructive text-white"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {status === "complete" ? "✓" : status === "error" ? "✕" : step}
      </div>
      <span
        className={
          status === "active"
            ? "text-foreground font-medium"
            : status === "complete"
            ? "text-green-500"
            : "text-muted-foreground"
        }
      >
        {label}
      </span>
    </div>
  );
}

function getStepStatus(
  currentStep: ExecuteStep,
  targetStep: string
): "pending" | "active" | "complete" | "error" {
  const steps = ["signing", "authenticating", "executing", "done"];
  const currentIndex = steps.indexOf(currentStep);
  const targetIndex = steps.indexOf(targetStep);

  if (currentStep === "error") {
    return currentIndex >= targetIndex ? "error" : "pending";
  }
  if (currentIndex > targetIndex) return "complete";
  if (currentIndex === targetIndex) return "active";
  return "pending";
}

function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15);
}
