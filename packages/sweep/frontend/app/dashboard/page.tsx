"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { WalletConnect } from "@/components/WalletConnect";
import { ChainSelector } from "@/components/ChainSelector";
import { DustTokenList } from "@/components/DustTokenList";
import { SweepPreview } from "@/components/SweepPreview";
import { SweepExecute } from "@/components/SweepExecute";
import { TransactionStatus } from "@/components/TransactionStatus";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { TokenSearch } from "@/components/TokenSearch";
import { SwapSettings } from "@/components/SwapSettings";
import { RecentActivity, QuickActions } from "@/components/RecentActivity";
import { useDustTokens } from "@/hooks/useDustTokens";
import { getSweepQuote } from "@/lib/api";
import { useToast } from "@/components/Toast";
import type { DustToken, SweepQuote, SweepStatus } from "@/lib/types";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { success: toastSuccess, error: toastError } = useToast();
  
  const [selectedChains, setSelectedChains] = useState<number[]>([
    8453, // Base
    42161, // Arbitrum
    137, // Polygon
  ]);
  const [selectedTokens, setSelectedTokens] = useState<DustToken[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<DustToken[]>([]);
  const [destination, setDestination] = useState<string>("usdc");
  const [quote, setQuote] = useState<SweepQuote | null>(null);
  const [sweepStatus, setSweepStatus] = useState<SweepStatus | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [deadline, setDeadline] = useState(20);
  const [step, setStep] = useState<"select" | "preview" | "execute" | "status">(
    "select"
  );

  const { data: dustTokens, isLoading, error, refetch } = useDustTokens({
    chainIds: selectedChains,
    enabled: isConnected && !!address,
  });

  // Handle token filtering from TokenSearch
  const handleFilteredTokens = useCallback((tokens: DustToken[]) => {
    setFilteredTokens(tokens);
  }, []);

  const handleTokenSelect = (token: DustToken, selected: boolean) => {
    if (selected) {
      setSelectedTokens([...selectedTokens, token]);
    } else {
      setSelectedTokens(selectedTokens.filter((t) => t.id !== token.id));
    }
  };

  const handleSelectAll = () => {
    const tokensToSelect = filteredTokens.length > 0 ? filteredTokens : dustTokens;
    if (tokensToSelect) {
      setSelectedTokens(tokensToSelect);
      toastSuccess(`Selected ${tokensToSelect.length} tokens`);
    }
  };

  const handleDeselectAll = () => {
    setSelectedTokens([]);
  };

  const handleGetQuote = async () => {
    if (!address || selectedTokens.length === 0) return;

    setIsQuoting(true);
    try {
      const result = await getSweepQuote(
        address,
        selectedTokens.map((t) => ({
          address: t.address,
          chainId: t.chainId,
        })),
        destination,
        1 // Default to mainnet for output
      );

      if (result) {
        setQuote(result);
        setStep("preview");
        toastSuccess("Quote ready!");
      }
    } catch (err: any) {
      console.error("Failed to get quote:", err);
      toastError(err.message || "Failed to get quote");
    } finally {
      setIsQuoting(false);
    }
  };

  const handleSweepComplete = (status: SweepStatus) => {
    setSweepStatus(status);
    setStep("status");
    if (status.status === "confirmed") {
      toastSuccess("Sweep completed successfully!");
    } else if (status.status === "failed") {
      toastError("Sweep failed. Please try again.");
    }
  };

  const handleReset = () => {
    setSelectedTokens([]);
    setQuote(null);
    setSweepStatus(null);
    setStep("select");
    refetch();
  };

  const totalValue = selectedTokens.reduce((sum, t) => sum + (t.valueUsd || t.balanceUsd || 0), 0);

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8">
            <span className="text-8xl">🧹</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to scan for dust tokens and start sweeping.
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
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { id: "select", label: "Select Tokens" },
            { id: "preview", label: "Preview" },
            { id: "execute", label: "Execute" },
            { id: "status", label: "Status" },
          ].map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : ["select", "preview", "execute", "status"].indexOf(step) >
                      i
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`ml-2 text-sm ${
                  step === s.id ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < 3 && (
                <div className="w-12 h-px bg-border mx-4" />
              )}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {step === "select" && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <QuickActions />

              {/* Portfolio Summary */}
              <PortfolioSummary tokens={dustTokens || []} isLoading={isLoading} />
              
              {/* Chain Selector */}
              <div className="bg-card rounded-xl border p-6">
                <h2 className="text-lg font-semibold mb-4">Select Chains</h2>
                <ChainSelector
                  selectedChains={selectedChains}
                  onChainsChange={setSelectedChains}
                />
              </div>

              {/* Dust Tokens */}
              <div className="bg-card rounded-xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    Dust Tokens
                    {dustTokens && (
                      <span className="text-muted-foreground font-normal ml-2">
                        ({dustTokens.length} found)
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-4">
                    <SwapSettings
                      slippage={slippage}
                      deadline={deadline}
                      onSlippageChange={setSlippage}
                      onDeadlineChange={setDeadline}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAll}
                        data-action="select-all"
                        className="text-sm text-primary hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button
                        onClick={handleDeselectAll}
                        className="text-sm text-primary hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                </div>

                {/* Token Search */}
                {dustTokens && dustTokens.length > 0 && (
                  <div className="mb-4">
                    <TokenSearch tokens={dustTokens} onFilter={handleFilteredTokens} />
                  </div>
                )}

                <DustTokenList
                  tokens={filteredTokens.length > 0 ? filteredTokens : (dustTokens || [])}
                  selectedTokens={selectedTokens}
                  onTokenSelect={handleTokenSelect}
                  isLoading={isLoading}
                  error={error}
                />
              </div>

              {/* Summary & Action */}
              <div className="bg-card rounded-xl border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Selected Value
                    </p>
                    <p className="text-2xl font-bold">
                      ${totalValue.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedTokens.length} tokens selected
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-1">
                        Destination
                      </label>
                      <select
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="bg-background border rounded-lg px-3 py-2"
                      >
                        <option value="usdc">USDC</option>
                        <option value="usdt">USDT</option>
                        <option value="eth">ETH</option>
                        <option value="aave">Aave (Yield)</option>
                        <option value="lido">Lido (stETH)</option>
                      </select>
                    </div>
                    <button
                      onClick={handleGetQuote}
                      disabled={selectedTokens.length === 0 || isQuoting}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isQuoting ? "Getting Quote..." : "Get Quote"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <RecentActivity limit={5} showViewAll={true} />
            </div>
          )}

          {step === "preview" && quote && (
            <SweepPreview
              quote={quote}
              onBack={() => setStep("select")}
              onConfirm={() => setStep("execute")}
            />
          )}

          {step === "execute" && quote && (
            <SweepExecute
              quote={quote}
              onComplete={handleSweepComplete}
              onBack={() => setStep("preview")}
            />
          )}

          {step === "status" && sweepStatus && (
            <TransactionStatus
              status={sweepStatus}
              onReset={handleReset}
            />
          )}
        </div>
      </div>
    </main>
  );
}
