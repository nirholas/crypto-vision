"use client";

import Image from "next/image";

interface DeFiVault {
  id: string;
  protocol: string;
  name: string;
  asset: string;
  apy: number;
  tvl: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  chainId: number;
  logoUrl?: string;
  description?: string;
}

interface DeFiDestinationsProps {
  vaults: DeFiVault[];
  selectedVault: string | null;
  onSelectVault: (vaultId: string) => void;
  isLoading?: boolean;
}

// Mock data for popular DeFi destinations
const POPULAR_VAULTS: DeFiVault[] = [
  {
    id: "aave-usdc",
    protocol: "Aave",
    name: "USDC Supply",
    asset: "USDC",
    apy: 4.5,
    tvl: 2500000000,
    riskLevel: "LOW",
    chainId: 1,
    logoUrl: "https://app.aave.com/icons/tokens/aave.svg",
    description: "Supply USDC to Aave and earn interest",
  },
  {
    id: "lido-steth",
    protocol: "Lido",
    name: "Staked ETH",
    asset: "stETH",
    apy: 3.8,
    tvl: 15000000000,
    riskLevel: "LOW",
    chainId: 1,
    logoUrl: "https://stake.lido.fi/favicon.ico",
    description: "Stake ETH and receive stETH with daily rewards",
  },
  {
    id: "compound-usdt",
    protocol: "Compound",
    name: "USDT Supply",
    asset: "USDT",
    apy: 3.2,
    tvl: 800000000,
    riskLevel: "LOW",
    chainId: 1,
    description: "Supply USDT to Compound",
  },
  {
    id: "yearn-dai",
    protocol: "Yearn",
    name: "DAI Vault",
    asset: "DAI",
    apy: 5.5,
    tvl: 500000000,
    riskLevel: "MEDIUM",
    chainId: 1,
    description: "Auto-compound DAI yields across protocols",
  },
  {
    id: "beefy-eth-arb",
    protocol: "Beefy",
    name: "ETH Compounder",
    asset: "ETH",
    apy: 6.2,
    tvl: 150000000,
    riskLevel: "MEDIUM",
    chainId: 42161,
    description: "Auto-compound ETH yields on Arbitrum",
  },
];

export function DeFiDestinations({
  vaults = POPULAR_VAULTS,
  selectedVault,
  onSelectVault,
  isLoading,
}: DeFiDestinationsProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">DeFi Destinations</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">DeFi Destinations</h2>
        <span className="text-sm text-muted-foreground">
          Deposit directly into yield-bearing vaults
        </span>
      </div>

      <div className="space-y-3">
        {vaults.map((vault) => (
          <button
            key={vault.id}
            onClick={() => onSelectVault(vault.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-colors text-left ${
              selectedVault === vault.id
                ? "bg-primary/10 border-primary"
                : "bg-background border-border hover:border-primary/50"
            }`}
          >
            {/* Protocol Logo */}
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {vault.logoUrl ? (
                <Image
                  src={vault.logoUrl}
                  alt={vault.protocol}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <span className="text-2xl">🏦</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{vault.protocol}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{vault.name}</span>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {vault.description}
              </p>
            </div>

            {/* APY & Risk */}
            <div className="text-right">
              <p className="text-lg font-bold text-green-500">
                {vault.apy.toFixed(1)}% APY
              </p>
              <div className="flex items-center justify-end gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    vault.riskLevel === "LOW"
                      ? "bg-green-500/10 text-green-500"
                      : vault.riskLevel === "MEDIUM"
                      ? "bg-yellow-500/10 text-yellow-500"
                      : "bg-red-500/10 text-red-500"
                  }`}
                >
                  {vault.riskLevel}
                </span>
                <span className="text-xs text-muted-foreground">
                  TVL: ${formatTVL(vault.tvl)}
                </span>
              </div>
            </div>

            {/* Selection indicator */}
            {selectedVault === vault.id && (
              <div className="text-primary">✓</div>
            )}
          </button>
        ))}
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground mt-4 text-center">
        💡 DeFi deposits earn yield automatically. You can withdraw anytime.
      </p>
    </div>
  );
}

function formatTVL(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}
