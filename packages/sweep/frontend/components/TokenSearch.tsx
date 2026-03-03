"use client";

import { useState, useMemo } from "react";
import type { DustToken } from "@/lib/types";
import { SUPPORTED_CHAINS } from "@/lib/chains";

interface TokenSearchProps {
  tokens: DustToken[];
  onFilter: (filtered: DustToken[]) => void;
}

type SortOption = "value-desc" | "value-asc" | "name-asc" | "name-desc" | "chain";

export function TokenSearch({ tokens, onFilter }: TokenSearchProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("value-desc");
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [hideSpam, setHideSpam] = useState(true);

  // Get unique chains from tokens
  const tokenChains = useMemo(() => {
    const chains = new Set(tokens.map((t) => t.chainId));
    return SUPPORTED_CHAINS.filter((c) => chains.has(c.id));
  }, [tokens]);

  // Apply filters and sorting
  useMemo(() => {
    let filtered = [...tokens];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.symbol.toLowerCase().includes(searchLower) ||
          t.name.toLowerCase().includes(searchLower) ||
          t.address.toLowerCase().includes(searchLower)
      );
    }

    // Chain filter
    if (selectedChain !== null) {
      filtered = filtered.filter((t) => t.chainId === selectedChain);
    }

    // Spam filter
    if (hideSpam) {
      filtered = filtered.filter((t) => !t.isSpam);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "value-desc":
          return (b.valueUsd || b.balanceUsd) - (a.valueUsd || a.balanceUsd);
        case "value-asc":
          return (a.valueUsd || a.balanceUsd) - (b.valueUsd || b.balanceUsd);
        case "name-asc":
          return a.symbol.localeCompare(b.symbol);
        case "name-desc":
          return b.symbol.localeCompare(a.symbol);
        case "chain":
          return a.chainId - b.chainId;
        default:
          return 0;
      }
    });

    onFilter(filtered);
  }, [tokens, search, sortBy, selectedChain, hideSpam, onFilter]);

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search by name, symbol, or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Chain Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Chain:</span>
          <select
            value={selectedChain ?? "all"}
            onChange={(e) =>
              setSelectedChain(e.target.value === "all" ? null : parseInt(e.target.value))
            }
            className="bg-background border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="all">All Chains</option>
            {tokenChains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.icon} {chain.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-background border rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="value-desc">Value (High → Low)</option>
            <option value="value-asc">Value (Low → High)</option>
            <option value="name-asc">Name (A → Z)</option>
            <option value="name-desc">Name (Z → A)</option>
            <option value="chain">By Chain</option>
          </select>
        </div>

        {/* Hide Spam Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hideSpam}
            onChange={(e) => setHideSpam(e.target.checked)}
            className="w-4 h-4 rounded border-muted-foreground"
          />
          <span className="text-sm">Hide spam</span>
        </label>
      </div>
    </div>
  );
}
