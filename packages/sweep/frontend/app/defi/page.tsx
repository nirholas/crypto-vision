"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { WalletConnect } from "@/components/WalletConnect";
import { APYComparisonTable, DeFiVaultCard } from "@/components/DeFiVaultCard";
import { useDefiPositions, type DefiPosition, type DefiVault } from "@/hooks/useDefiPositions";
import { SUPPORTED_CHAINS } from "@/lib/chains";

export default function DeFiPage() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { data: positions, isLoading, error, refetch } = useDefiPositions();
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"positions" | "discover">("positions");

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="mb-8">
            <span className="text-8xl">📈</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">DeFi Positions</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet to view your DeFi positions.
          </p>
          <WalletConnect />
        </div>
      </main>
    );
  }

  // Calculate totals
  const totalValue = positions?.reduce((sum: number, p: DefiPosition) => sum + p.valueUsd, 0) ?? 0;
  const totalYield = positions?.reduce((sum: number, p: DefiPosition) => sum + (p.pendingRewards || 0), 0) ?? 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">DeFi Yield</h1>
              <p className="text-muted-foreground">
                Track positions and discover new yield opportunities
              </p>
            </div>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-xl border p-6">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-primary">
                ${totalValue.toFixed(2)}
              </p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <p className="text-sm text-muted-foreground">Pending Rewards</p>
              <p className="text-2xl font-bold text-green-500">
                ${totalYield.toFixed(2)}
              </p>
            </div>
            <div className="bg-card rounded-xl border p-6">
              <p className="text-sm text-muted-foreground">Active Positions</p>
              <p className="text-2xl font-bold">{positions?.length ?? 0}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
            <button
              onClick={() => setActiveTab("positions")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "positions"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Your Positions
            </button>
            <button
              onClick={() => setActiveTab("discover")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "discover"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Discover Vaults
            </button>
          </div>

          {/* Positions List */}
          {activeTab === "positions" && (
          <div className="bg-card rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Your Positions</h2>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-destructive mb-2">Failed to load positions</p>
                <p className="text-sm text-muted-foreground">{error.message}</p>
              </div>
            ) : positions && positions.length > 0 ? (
              <div className="space-y-3">
                {positions.map((position: DefiPosition) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    isSelected={selectedPosition === position.id}
                    onSelect={() =>
                      setSelectedPosition(
                        selectedPosition === position.id ? null : position.id
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">🌱</p>
                <p className="text-muted-foreground">No DeFi positions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Sweep your dust tokens into DeFi to start earning yield
                </p>
              </div>
            )}
          </div>
          )}

          {/* Discover Vaults Tab */}
          {activeTab === "discover" && (
            <div className="space-y-6">
              {/* Quick Deposit CTA */}
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Quick Deposit from Dashboard</h3>
                    <p className="text-sm text-muted-foreground">
                      Sweep your dust tokens directly into yield-bearing positions
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/")}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              </div>

              {/* APY Comparison Table */}
              <APYComparisonTable
                vaults={DEFI_VAULTS}
                onSelectVault={handleVaultSelect}
              />

              {/* Featured Vaults Grid */}
              <div className="bg-card rounded-xl border p-6">
                <h2 className="text-lg font-semibold mb-4">Featured Vaults</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DEFI_VAULTS.slice(0, 4).map((vault) => (
                    <DeFiVaultCard
                      key={vault.id}
                      vault={vault}
                      showDepositButton
                      onDeposit={() => handleVaultSelect(vault.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Legacy Available Vaults - shown in positions tab */}
          {activeTab === "positions" && (
          <div className="bg-card rounded-xl border p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">Suggested Vaults</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEFI_VAULTS.slice(0, 4).map((vault) => (
                <DeFiVaultCard
                  key={vault.id}
                  vault={vault}
                  compact
                  showDepositButton
                  onDeposit={() => handleVaultSelect(vault.id)}
                />
              ))}
            </div>
            <button
              onClick={() => setActiveTab("discover")}
              className="w-full mt-4 py-2 text-sm text-primary hover:underline"
            >
              View all vaults →
            </button>
          </div>
          )}
        </div>
      </div>
    </main>
  );

  function handleVaultSelect(vaultId: string) {
    // Navigate to dashboard with vault as destination
    router.push(`/?destination=${vaultId}`);
  }
}

function PositionCard({
  position,
  isSelected,
  onSelect,
}: {
  position: DefiPosition;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const chain = SUPPORTED_CHAINS.find((c) => c.id === position.chainId);

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary/5 border-primary"
          : "bg-background border-border hover:border-primary/50"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Protocol Icon */}
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl">
          {position.protocol === "Aave" && "🏦"}
          {position.protocol === "Lido" && "🌊"}
          {position.protocol === "Compound" && "🏛️"}
          {position.protocol === "Yearn" && "🔷"}
          {!["Aave", "Lido", "Compound", "Yearn"].includes(position.protocol) && "📈"}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{position.protocol}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">{position.asset}</span>
            <span className="text-xs px-2 py-0.5 bg-muted rounded">
              {chain?.icon} {chain?.name}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            APY: <span className="text-green-500">{position.apy.toFixed(2)}%</span>
          </p>
        </div>

        {/* Value */}
        <div className="text-right">
          <p className="font-semibold">${position.valueUsd.toFixed(2)}</p>
          {position.pendingRewards && position.pendingRewards > 0 && (
            <p className="text-sm text-green-500">
              +${position.pendingRewards.toFixed(4)} pending
            </p>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isSelected && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Deposited</p>
              <p className="font-medium">
                {position.balance} {position.asset}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Current Value</p>
              <p className="font-medium">${position.valueUsd.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Entry Date</p>
              <p className="font-medium">
                {new Date(position.entryDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Earned</p>
              <p className="font-medium text-green-500">
                ${((position.earnedTotal || 0)).toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80">
              Deposit More
            </button>
            <button className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90">
              Withdraw
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// DeFi vaults with full type information
const DEFI_VAULTS: DefiVault[] = [
  {
    id: "aave-usdc-base",
    protocol: "Aave",
    name: "USDC Supply",
    asset: "USDC",
    chainId: 8453,
    apy: 4.5,
    tvl: 125000000,
    riskLevel: "LOW",
    vaultAddress: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
    description: "Supply USDC to Aave V3 on Base and earn yield from borrowers",
  },
  {
    id: "lido-steth-mainnet",
    protocol: "Lido",
    name: "Staked ETH",
    asset: "ETH",
    chainId: 1,
    apy: 3.8,
    tvl: 9500000000,
    riskLevel: "LOW",
    vaultAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    description: "Stake ETH with Lido to earn staking rewards while keeping liquidity",
  },
  {
    id: "compound-usdt-arbitrum",
    protocol: "Compound",
    name: "USDT Supply",
    asset: "USDT",
    chainId: 42161,
    apy: 3.2,
    tvl: 85000000,
    riskLevel: "LOW",
    vaultAddress: "0xd98Be00b5D27fc98112BdE293e487f8D4cA57d07",
    description: "Supply USDT to Compound V3 on Arbitrum for competitive yields",
  },
  {
    id: "yearn-dai-mainnet",
    protocol: "Yearn",
    name: "DAI Vault",
    asset: "DAI",
    chainId: 1,
    apy: 5.5,
    tvl: 42000000,
    riskLevel: "MEDIUM",
    vaultAddress: "0xdA816459F1AB5631232FE5e97a05BBBb94970c95",
    description: "Auto-compounding DAI strategy vault with optimized yield farming",
  },
  {
    id: "aave-weth-base",
    protocol: "Aave",
    name: "WETH Supply",
    asset: "WETH",
    chainId: 8453,
    apy: 2.1,
    tvl: 78000000,
    riskLevel: "LOW",
    vaultAddress: "0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7",
    description: "Supply WETH to Aave V3 on Base for passive ETH yield",
  },
  {
    id: "morpho-usdc-mainnet",
    protocol: "Morpho",
    name: "USDC Optimizer",
    asset: "USDC",
    chainId: 1,
    apy: 6.2,
    tvl: 156000000,
    riskLevel: "MEDIUM",
    vaultAddress: "0x8888882f8f843896699869179fB6E4f7e3B58888",
    description: "Optimized USDC lending via Morpho peer-to-peer matching",
  },
];
