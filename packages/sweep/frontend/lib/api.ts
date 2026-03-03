import type {
  DustToken,
  SweepQuote,
  SweepStatus,
  ExecuteSweepRequest,
  ExecuteSweepResponse,
  WalletTokensResponse,
  QuoteResponse,
  ApiResponse,
} from "./types";

// API base URL from environment
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Custom fetch wrapper with error handling
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`API Error [${endpoint}]:`, error);
    return {
      success: false,
      error: error.message || "Network error",
    };
  }
}

// ============================================
// Wallet API
// ============================================

/**
 * Fetch dust tokens for a wallet across all supported chains
 */
export async function getDustTokens(
  wallet: string,
  chainIds?: number[]
): Promise<DustToken[]> {
  const params = new URLSearchParams({ wallet });
  if (chainIds?.length) {
    params.append("chains", chainIds.join(","));
  }

  const result = await apiFetch<WalletTokensResponse>(
    `/api/wallet/tokens?${params}`
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch tokens");
  }

  return result.data.tokens;
}

/**
 * Fetch wallet summary with chain breakdown
 */
export async function getWalletSummary(wallet: string): Promise<WalletTokensResponse> {
  const result = await apiFetch<WalletTokensResponse>(
    `/api/wallet/summary?wallet=${wallet}`
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch wallet summary");
  }

  return result.data;
}

// ============================================
// Quote API
// ============================================

/**
 * Get a sweep quote for selected tokens
 */
export async function getSweepQuote(
  wallet: string,
  tokens: Array<{ address: string; chainId: number }>,
  outputToken: string,
  outputChainId: number
): Promise<SweepQuote> {
  const result = await apiFetch<QuoteResponse>("/api/quote", {
    method: "POST",
    body: JSON.stringify({
      wallet,
      tokens,
      outputToken,
      outputChainId,
    }),
  });

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get quote");
  }

  return result.data.quote;
}

/**
 * Refresh an existing quote
 */
export async function refreshQuote(quoteId: string): Promise<SweepQuote> {
  const result = await apiFetch<QuoteResponse>(`/api/quote/${quoteId}/refresh`, {
    method: "POST",
  });

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to refresh quote");
  }

  return result.data.quote;
}

// ============================================
// Sweep API
// ============================================

/**
 * Execute a sweep with signed authorization
 */
export async function executeSweep(
  request: ExecuteSweepRequest
): Promise<ExecuteSweepResponse> {
  const result = await apiFetch<ExecuteSweepResponse>("/api/sweep", {
    method: "POST",
    body: JSON.stringify(request),
  });

  if (!result.success) {
    return {
      success: false,
      sweepId: "",
      error: result.error,
    };
  }

  return result.data!;
}

/**
 * Get sweep status by ID
 */
export async function getSweepStatus(sweepId: string): Promise<SweepStatus> {
  const result = await apiFetch<SweepStatus>(`/api/sweep/${sweepId}/status`);

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get sweep status");
  }

  return result.data;
}

/**
 * Get sweep history for a wallet
 */
export async function getSweepHistory(
  wallet: string,
  limit = 10
): Promise<SweepStatus[]> {
  const result = await apiFetch<{ sweeps: SweepStatus[] }>(
    `/api/sweep/history?wallet=${wallet}&limit=${limit}`
  );

  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get sweep history");
  }

  return result.data.sweeps;
}

// ============================================
// SSE Stream for real-time updates
// ============================================

/**
 * Subscribe to sweep status updates via Server-Sent Events
 */
export function subscribeSweepStatus(
  sweepId: string,
  onStatus: (status: SweepStatus) => void,
  onError?: (error: Error) => void
): () => void {
  const eventSource = new EventSource(`${API_BASE}/api/sweep/${sweepId}/stream`);

  eventSource.onmessage = (event) => {
    try {
      const status = JSON.parse(event.data) as SweepStatus;
      onStatus(status);

      // Close connection when sweep is complete
      if (status.status === "confirmed" || status.status === "failed") {
        eventSource.close();
      }
    } catch (error) {
      console.error("SSE parse error:", error);
    }
  };

  eventSource.onerror = (event) => {
    console.error("SSE error:", event);
    onError?.(new Error("Connection lost"));
    eventSource.close();
  };

  // Return cleanup function
  return () => eventSource.close();
}

// ============================================
// DeFi API
// ============================================

interface DefiPosition {
  id: string;
  protocol: string;
  chainId: number;
  asset: string;
  balance: string;
  valueUsd: number;
  apy: number;
  pendingRewards?: number;
  earnedTotal?: number;
  entryDate: number;
  vaultAddress: string;
}

interface DefiVault {
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
  vaultAddress: string;
}

/**
 * Get user's DeFi positions
 */
export async function getDefiPositions(wallet: string): Promise<DefiPosition[]> {
  const result = await apiFetch<{ positions: DefiPosition[] }>(
    `/api/defi/positions?wallet=${wallet}`
  );

  if (!result.success || !result.data) {
    // Return empty array as fallback (user may not have any positions)
    return [];
  }

  return result.data.positions;
}

/**
 * Get available DeFi vaults
 */
export async function getDefiVaults(chainId?: number): Promise<DefiVault[]> {
  const params = chainId ? `?chainId=${chainId}` : "";
  const result = await apiFetch<{ vaults: DefiVault[] }>(
    `/api/defi/vaults${params}`
  );

  if (!result.success || !result.data) {
    // Return mock vaults as fallback
    return [
      {
        id: "aave-usdc",
        protocol: "Aave",
        name: "USDC Supply",
        asset: "USDC",
        apy: 4.5,
        tvl: 2500000000,
        riskLevel: "LOW",
        chainId: 1,
        description: "Supply USDC to Aave and earn interest",
        vaultAddress: "0x...",
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
        description: "Stake ETH and receive stETH with daily rewards",
        vaultAddress: "0x...",
      },
    ];
  }

  return result.data.vaults;
}

/**
 * Deposit into a DeFi vault
 */
export async function depositToVault(
  wallet: string,
  vaultId: string,
  amount: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const result = await apiFetch<{ success: boolean; txHash?: string }>(
    "/api/defi/deposit",
    {
      method: "POST",
      body: JSON.stringify({ wallet, vaultId, amount }),
    }
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return result.data!;
}

/**
 * Withdraw from a DeFi position
 */
export async function withdrawFromVault(
  wallet: string,
  positionId: string,
  amount?: string
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  const result = await apiFetch<{ success: boolean; txHash?: string }>(
    "/api/defi/withdraw",
    {
      method: "POST",
      body: JSON.stringify({ wallet, positionId, amount }),
    }
  );

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return result.data!;
}

// ============================================
// Utility functions
// ============================================

/**
 * Check API health
 */
export async function checkHealth(): Promise<boolean> {
  const result = await apiFetch<{ status: string }>("/health");
  return result.success && result.data?.status === "ok";
}

/**
 * Get supported chains from API
 */
export async function getSupportedChains(): Promise<number[]> {
  const result = await apiFetch<{ chains: number[] }>("/api/chains");
  
  if (!result.success || !result.data) {
    // Fallback to default chains
    return [1, 8453, 42161, 137, 56, 59144];
  }

  return result.data.chains;
}
