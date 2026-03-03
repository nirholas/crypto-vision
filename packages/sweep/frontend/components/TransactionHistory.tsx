"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getSweepHistory } from "@/lib/api";
import type { SweepStatus } from "@/lib/types";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface TransactionHistoryProps {
  limit?: number;
  showFilters?: boolean;
}

export function TransactionHistory({
  limit = 10,
  showFilters = true,
}: TransactionHistoryProps) {
  const { address } = useAccount();
  const [history, setHistory] = useState<SweepStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchHistory() {
      if (!address) return;

      setIsLoading(true);
      setError(null);

      try {
        const sweeps = await getSweepHistory(address, limit);
        setHistory(sweeps);
      } catch (err: any) {
        setError(err.message || "Failed to load history");
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [address, limit]);

  const filteredHistory = history.filter((sweep) => {
    if (statusFilter === "all") return true;
    return sweep.status === statusFilter;
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">Transaction History</h2>
        <div className="text-center py-8">
          <p className="text-destructive mb-2">Failed to load history</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Transaction History</h2>
        {showFilters && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        )}
      </div>

      {filteredHistory.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-2">📭</p>
          <p className="text-muted-foreground">No transactions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Your sweep history will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((sweep) => (
            <SweepHistoryItem key={sweep.id} sweep={sweep} />
          ))}
        </div>
      )}
    </div>
  );
}

function SweepHistoryItem({ sweep }: { sweep: SweepStatus }) {
  const date = new Date(sweep.createdAt);

  return (
    <div className="flex items-center gap-4 p-4 bg-background rounded-lg">
      {/* Status Icon */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          sweep.status === "confirmed"
            ? "bg-green-500/20 text-green-500"
            : sweep.status === "failed"
            ? "bg-red-500/20 text-red-500"
            : "bg-yellow-500/20 text-yellow-500"
        }`}
      >
        {sweep.status === "confirmed" && "✓"}
        {sweep.status === "failed" && "✕"}
        {sweep.status === "pending" && "⏳"}
        {sweep.status === "submitted" && "📤"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            Swept {sweep.tokensSwept || 0} tokens
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              sweep.status === "confirmed"
                ? "bg-green-500/10 text-green-500"
                : sweep.status === "failed"
                ? "bg-red-500/10 text-red-500"
                : "bg-yellow-500/10 text-yellow-500"
            }`}
          >
            {sweep.status}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {date.toLocaleDateString()} at {date.toLocaleTimeString()}
        </p>
      </div>

      {/* Output */}
      <div className="text-right">
        {sweep.outputAmount && sweep.outputToken && (
          <p className="font-medium">
            {parseFloat(sweep.outputAmount).toFixed(4)} {sweep.outputToken}
          </p>
        )}
        {sweep.gasSaved && sweep.gasSaved > 0 && (
          <p className="text-sm text-green-500">
            Saved ${sweep.gasSaved.toFixed(2)} gas
          </p>
        )}
      </div>

      {/* View Transaction */}
      {sweep.transactions && sweep.transactions.length > 0 && (
        <a
          href={getExplorerUrl(
            sweep.transactions[0].chainId,
            sweep.transactions[0].hash
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          View ↗
        </a>
      )}
    </div>
  );
}

function getExplorerUrl(chainId: number, hash: string): string {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  const baseUrl = chain?.blockExplorerUrl || "https://etherscan.io";
  return `${baseUrl}/tx/${hash}`;
}
