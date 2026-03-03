"use client";

import { useEffect, useState } from "react";
import type { SweepStatus, TransactionInfo } from "@/lib/types";

interface TransactionStatusProps {
  status: SweepStatus;
  onReset: () => void;
}

export function TransactionStatus({ status, onReset }: TransactionStatusProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const isSuccess = status.status === "confirmed";
  const isFailed = status.status === "failed";

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className="bg-card rounded-xl border p-8 text-center">
        {/* Status Icon */}
        <div className="mb-6">
          {isSuccess ? (
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          ) : isFailed ? (
            <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-10 h-10 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          ) : (
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Status Title */}
        <h2 className="text-2xl font-bold mb-2">
          {isSuccess && "Sweep Complete! 🎉"}
          {isFailed && "Sweep Failed"}
          {!isSuccess && !isFailed && "Processing..."}
        </h2>

        {/* Status Message */}
        <p className="text-muted-foreground mb-6">
          {isSuccess &&
            `Successfully swept ${status.tokensSwept || 0} tokens to ${status.outputToken || "ETH"}`}
          {isFailed && (status.error || "An error occurred during the sweep")}
          {!isSuccess && !isFailed && `Waiting for confirmation... (${elapsed}s)`}
        </p>

        {/* Transaction Summary */}
        {isSuccess && status.transactions && status.transactions.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-3">Transaction Details</h3>
            <div className="space-y-2">
              {status.transactions.map((tx: TransactionInfo, index: number) => (
                <TransactionRow key={tx.hash || index} tx={tx} />
              ))}
            </div>
          </div>
        )}

        {/* Output Summary */}
        {isSuccess && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-500/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Tokens Swept</p>
              <p className="text-2xl font-bold text-green-500">
                {status.tokensSwept || 0}
              </p>
            </div>
            <div className="bg-primary/10 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Received</p>
              <p className="text-2xl font-bold text-primary">
                {formatAmount(status.outputAmount)} {status.outputToken}
              </p>
            </div>
          </div>
        )}

        {/* Gas Savings Badge */}
        {isSuccess && status.gasSaved && (
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-semibold">
              Saved ${status.gasSaved.toFixed(2)} in gas fees!
            </span>
          </div>
        )}
      </div>

      {/* Chain Transactions */}
      {status.chainStatuses && Object.keys(status.chainStatuses).length > 0 && (
        <div className="bg-card rounded-xl border p-6">
          <h3 className="font-semibold mb-4">Chain Status</h3>
          <div className="space-y-3">
            {Object.entries(status.chainStatuses).map(([chainId, chainStatus]: [string, any]) => (
              <div
                key={chainId}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <ChainIcon chainId={parseInt(chainId)} />
                  <span className="font-medium">{getChainName(parseInt(chainId))}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      chainStatus.status === "confirmed"
                        ? "bg-green-500/20 text-green-500"
                        : chainStatus.status === "failed"
                        ? "bg-destructive/20 text-destructive"
                        : "bg-yellow-500/20 text-yellow-500"
                    }`}
                  >
                    {chainStatus.status}
                  </span>
                  {chainStatus.txHash && (
                    <a
                      href={getExplorerUrl(parseInt(chainId), chainStatus.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      View ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        {(isSuccess || isFailed) && (
          <>
            <button
              onClick={onReset}
              className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              New Sweep
            </button>
            {isSuccess && (
              <a
                href={`https://debank.com/profile/${status.wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition-colors text-center"
              >
                View Portfolio
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: TransactionInfo }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <ChainIcon chainId={tx.chainId} />
        <span className="text-muted-foreground">
          {tx.hash ? `${tx.hash.slice(0, 8)}...${tx.hash.slice(-6)}` : "Pending"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`px-2 py-0.5 rounded text-xs ${
            tx.status === "confirmed"
              ? "bg-green-500/20 text-green-500"
              : tx.status === "failed"
              ? "bg-destructive/20 text-destructive"
              : "bg-yellow-500/20 text-yellow-500"
          }`}
        >
          {tx.status}
        </span>
        {tx.hash && (
          <a
            href={getExplorerUrl(tx.chainId, tx.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            ↗
          </a>
        )}
      </div>
    </div>
  );
}

function ChainIcon({ chainId }: { chainId: number }) {
  const icons: Record<number, string> = {
    1: "Ξ", // Ethereum
    56: "🔶", // BNB
    137: "🟣", // Polygon
    42161: "🔵", // Arbitrum
    8453: "🔵", // Base
    59144: "🟢", // Linea
  };

  return (
    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-muted text-sm">
      {icons[chainId] || "⛓"}
    </span>
  );
}

function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: "Ethereum",
    56: "BNB Chain",
    137: "Polygon",
    42161: "Arbitrum",
    8453: "Base",
    59144: "Linea",
  };
  return names[chainId] || `Chain ${chainId}`;
}

function getExplorerUrl(chainId: number, hash: string): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io",
    56: "https://bscscan.com",
    137: "https://polygonscan.com",
    42161: "https://arbiscan.io",
    8453: "https://basescan.org",
    59144: "https://lineascan.build",
  };
  const base = explorers[chainId] || "https://etherscan.io";
  return `${base}/tx/${hash}`;
}

function formatAmount(amount?: string | number): string {
  if (!amount) return "0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(6);
  return num.toExponential(2);
}
