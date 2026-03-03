"use client";

import { SUPPORTED_CHAINS } from "@/lib/chains";

interface ChainSelectorProps {
  selectedChains: number[];
  onChainsChange: (chains: number[]) => void;
}

export function ChainSelector({
  selectedChains,
  onChainsChange,
}: ChainSelectorProps) {
  const handleToggle = (chainId: number) => {
    if (selectedChains.includes(chainId)) {
      onChainsChange(selectedChains.filter((c) => c !== chainId));
    } else {
      onChainsChange([...selectedChains, chainId]);
    }
  };

  const handleSelectAll = () => {
    onChainsChange(SUPPORTED_CHAINS.map((c) => c.id));
  };

  const handleDeselectAll = () => {
    onChainsChange([]);
  };

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={handleSelectAll}
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
      <div className="flex flex-wrap gap-3">
        {SUPPORTED_CHAINS.map((chain) => (
          <button
            key={chain.id}
            onClick={() => handleToggle(chain.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
              selectedChains.includes(chain.id)
                ? "bg-primary/10 border-primary text-foreground"
                : "bg-background border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            <span className="text-xl">{chain.icon}</span>
            <span className="font-medium">{chain.name}</span>
            {selectedChains.includes(chain.id) && (
              <span className="text-primary">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
