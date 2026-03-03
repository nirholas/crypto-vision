"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { TransactionHistory } from "@/components/TransactionHistory";
import { WalletConnect } from "@/components/WalletConnect";

export default function HistoryPage() {
  const { isConnected } = useAccount();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [chainFilter, setChainFilter] = useState<number | null>(null);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8">
            <span className="text-8xl">📜</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Transaction History</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to view your sweep history.
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Transaction History</h1>
            <p className="text-muted-foreground">
              View all your past dust sweeps and their status
            </p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-xl border p-6">
              <p className="text-sm text-muted-foreground">Total Sweeps</p>
              <p className="text-2xl font-bold">--</p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <p className="text-sm text-muted-foreground">Total Value Swept</p>
              <p className="text-2xl font-bold text-primary">$--</p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <p className="text-sm text-muted-foreground">Gas Saved</p>
              <p className="text-2xl font-bold text-green-500">$--</p>
            </div>
          </div>

          {/* Transaction History */}
          <TransactionHistory limit={20} showFilters={true} />
        </div>
      </div>
    </main>
  );
}
