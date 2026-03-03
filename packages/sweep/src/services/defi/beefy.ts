/**
 * Beefy Finance Protocol Integration
 * Multi-chain yield optimizer with auto-compounding vaults
 */

import { type Address, type Hex, encodeFunctionData, parseUnits, formatUnits } from "viem";
import { getViemClient } from "../../utils/viem.js";
import { cacheGetOrFetch } from "../../utils/redis.js";
import {
  DeFiProtocol,
  DeFiProductType,
  RiskLevel,
  type DeFiProvider,
  type DeFiVault,
  type YieldVault,
  type DeFiAsset,
  type ApyData,
  type DepositQuote,
  type WithdrawQuote,
  type DeFiPosition,
  DeFiError,
} from "./types.js";

// ============================================================
// Beefy API Configuration
// ============================================================

const BEEFY_API_BASE = "https://api.beefy.finance";
const BEEFY_APP_API = "https://app.beefy.com/api";

const BEEFY_CHAIN_MAPPING: Record<string, string> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  polygon: "polygon",
  base: "base",
  optimism: "optimism",
  bsc: "bsc",
  avalanche: "avax",
  fantom: "fantom",
};

const BEEFY_SUPPORTED_CHAINS = Object.keys(BEEFY_CHAIN_MAPPING);

// ============================================================
// ABIs
// ============================================================

const BEEFY_VAULT_ABI = [
  {
    inputs: [{ name: "_amount", type: "uint256" }],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "depositAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "_shares", type: "uint256" }],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "withdrawAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "balance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPricePerFullShare",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "want",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "strategy",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ============================================================
// API Response Types
// ============================================================

interface BeefyVaultResponse {
  id: string;
  name: string;
  token: string;
  tokenAddress: string;
  tokenDecimals: number;
  tokenProviderId: string;
  earnedToken: string;
  earnedTokenAddress: string;
  earnContractAddress: string;
  oracle: string;
  oracleId: string;
  status: "active" | "paused" | "eol";
  platformId: string;
  assets: string[];
  risks: string[];
  strategyTypeId: string;
  buyTokenUrl?: string;
  addLiquidityUrl?: string;
  network: string;
  createdAt: number;
  chain: string;
  strategy: string;
  lastHarvest: number;
  pricePerFullShare: string;
  tvl?: number;
}

interface BeefyApyResponse {
  [vaultId: string]: number;
}

interface BeefyTvlResponse {
  [vaultId: string]: number;
}

interface BeefyPriceResponse {
  [tokenId: string]: number;
}

// ============================================================
// Helper Functions
// ============================================================

function mapRiskLevelFromBeefyRisks(risks: string[]): RiskLevel {
  const highRiskIndicators = ["IL", "COMPLEXITY", "CONTRACTS", "AUDIT"];
  const mediumRiskIndicators = ["PLATFORM", "MCAP", "LIQUIDITY"];

  const hasHighRisk = risks.some((r) => 
    highRiskIndicators.some((indicator) => r.toUpperCase().includes(indicator))
  );
  
  if (hasHighRisk) return RiskLevel.HIGH;
  
  const hasMediumRisk = risks.some((r) =>
    mediumRiskIndicators.some((indicator) => r.toUpperCase().includes(indicator))
  );
  
  if (hasMediumRisk) return RiskLevel.MEDIUM;
  
  return RiskLevel.LOW;
}

// ============================================================
// Beefy Provider Implementation
// ============================================================

export class BeefyProvider implements DeFiProvider {
  protocol = DeFiProtocol.BEEFY;
  name = "Beefy Finance";
  supportedChains = BEEFY_SUPPORTED_CHAINS;

  private vaultsCache: Map<string, BeefyVaultResponse[]> = new Map();
  private apysCache: BeefyApyResponse = {};
  private tvlsCache: BeefyTvlResponse = {};
  private pricesCache: BeefyPriceResponse = {};

  /**
   * Fetch all Beefy vaults
   */
  private async fetchAllVaults(): Promise<BeefyVaultResponse[]> {
    const response = await fetch(`${BEEFY_API_BASE}/vaults`);
    if (!response.ok) {
      throw new Error(`Beefy vaults API error: ${response.status}`);
    }
    return response.json() as Promise<BeefyVaultResponse[]>;
  }

  /**
   * Fetch APYs for all vaults
   */
  private async fetchApys(): Promise<BeefyApyResponse> {
    const response = await fetch(`${BEEFY_API_BASE}/apy`);
    if (!response.ok) {
      throw new Error(`Beefy APY API error: ${response.status}`);
    }
    return response.json() as Promise<BeefyApyResponse>;
  }

  /**
   * Fetch TVLs for all vaults
   */
  private async fetchTvls(): Promise<BeefyTvlResponse> {
    const response = await fetch(`${BEEFY_API_BASE}/tvl`);
    if (!response.ok) {
      throw new Error(`Beefy TVL API error: ${response.status}`);
    }
    return response.json() as Promise<BeefyTvlResponse>;
  }

  /**
   * Fetch token prices
   */
  private async fetchPrices(): Promise<BeefyPriceResponse> {
    const response = await fetch(`${BEEFY_API_BASE}/prices`);
    if (!response.ok) {
      throw new Error(`Beefy prices API error: ${response.status}`);
    }
    return response.json() as Promise<BeefyPriceResponse>;
  }

  /**
   * Refresh cache data
   */
  private async refreshCache(): Promise<void> {
    const cacheKey = "beefy:cache:all";
    
    await cacheGetOrFetch(cacheKey, async () => {
      const [vaults, apys, tvls, prices] = await Promise.all([
        this.fetchAllVaults(),
        this.fetchApys(),
        this.fetchTvls(),
        this.fetchPrices(),
      ]);

      // Organize vaults by chain
      this.vaultsCache.clear();
      for (const vault of vaults) {
        const chain = vault.chain || vault.network;
        if (!this.vaultsCache.has(chain)) {
          this.vaultsCache.set(chain, []);
        }
        this.vaultsCache.get(chain)!.push(vault);
      }

      this.apysCache = apys;
      this.tvlsCache = tvls;
      this.pricesCache = prices;

      return { updated: Date.now() };
    }, 300); // Cache for 5 minutes
  }

  /**
   * Get Beefy vaults on a chain
   */
  async getVaults(chain: string): Promise<YieldVault[]> {
    const beefyChain = BEEFY_CHAIN_MAPPING[chain];
    if (!beefyChain) {
      return [];
    }

    await this.refreshCache();

    const apiVaults = this.vaultsCache.get(beefyChain) || [];
    const chainId = this.getChainId(chain);

    const vaults: YieldVault[] = apiVaults
      .filter((v) => v.status === "active" && (this.tvlsCache[v.id] || 0) > 10000)
      .map((v) => {
        const apy = this.apysCache[v.id] || 0;
        const tvl = this.tvlsCache[v.id] || 0;
        const tokenPrice = this.pricesCache[v.oracleId] || 0;

        const depositAsset: DeFiAsset = {
          address: v.tokenAddress as Address,
          symbol: v.token,
          name: v.name,
          decimals: v.tokenDecimals,
          chain,
          priceUsd: tokenPrice,
        };

        const receiptAsset: DeFiAsset = {
          address: v.earnContractAddress as Address,
          symbol: v.earnedToken,
          name: `Moo ${v.name}`,
          decimals: 18,
          chain,
        };

        const vault: YieldVault = {
          id: `beefy-${chain}-${v.id}`,
          protocol: DeFiProtocol.BEEFY,
          productType: DeFiProductType.VAULT,
          name: v.name,
          symbol: v.earnedToken,
          address: v.earnContractAddress as Address,
          chain,
          chainId,
          depositToken: depositAsset,
          receiptToken: receiptAsset,
          apy,
          apyBase: apy,
          apyReward: 0,
          tvlUsd: tvl,
          riskLevel: mapRiskLevelFromBeefyRisks(v.risks || []),
          audited: true, // Beefy is audited
          active: v.status === "active",
          strategy: v.strategyTypeId,
          strategyAddress: v.strategy as Address,
          performanceFee: 0.045, // Beefy charges 4.5% performance fee
          managementFee: 0,
          description: `${v.platformId} strategy: ${v.assets.join("-")}`,
          lastUpdated: Date.now(),
        };

        return vault;
      });

    return vaults;
  }

  private getChainId(chain: string): number {
    const chainIds: Record<string, number> = {
      ethereum: 1,
      arbitrum: 42161,
      polygon: 137,
      base: 8453,
      optimism: 10,
      bsc: 56,
      avalanche: 43114,
      fantom: 250,
    };
    return chainIds[chain] || 0;
  }

  /**
   * Get a specific vault
   */
  async getVault(chain: string, vaultAddress: string): Promise<YieldVault | null> {
    const vaults = await this.getVaults(chain);
    return vaults.find(
      (v) => v.address.toLowerCase() === vaultAddress.toLowerCase()
    ) || null;
  }

  /**
   * Get APY data
   */
  async getApy(chain: string, vaultAddress: string): Promise<ApyData> {
    const vault = await this.getVault(chain, vaultAddress);
    
    if (!vault) {
      throw new DeFiError(
        `Vault ${vaultAddress} not found on Beefy ${chain}`,
        DeFiProtocol.BEEFY,
        "VAULT_NOT_FOUND"
      );
    }

    return {
      protocol: DeFiProtocol.BEEFY,
      vault: vaultAddress,
      chain,
      asset: vault.depositToken.address.toString(),
      apy: vault.apy,
      apyBase: vault.apyBase || vault.apy,
      apyReward: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get deposit quote
   */
  async getDepositQuote(
    chain: string,
    vaultAddress: string,
    amount: string,
    userAddress: string
  ): Promise<DepositQuote> {
    const vault = await this.getVault(chain, vaultAddress);
    
    if (!vault) {
      throw new DeFiError(
        `Vault ${vaultAddress} not found on Beefy ${chain}`,
        DeFiProtocol.BEEFY,
        "VAULT_NOT_FOUND"
      );
    }

    const client = getViemClient(chain as any);
    const depositToken = vault.depositToken;
    const parsedAmount = parseUnits(amount, depositToken.decimals);

    // Get price per share
    const pricePerShare = await client.readContract({
      address: vaultAddress as Address,
      abi: BEEFY_VAULT_ABI,
      functionName: "getPricePerFullShare",
    }) as bigint;

    // Calculate expected shares
    const expectedShares = (parsedAmount * BigInt(1e18)) / pricePerShare;

    // Build deposit calldata
    const calldata = encodeFunctionData({
      abi: BEEFY_VAULT_ABI,
      functionName: "deposit",
      args: [parsedAmount],
    });

    const depositValueUsd = Number(amount) * (depositToken.priceUsd || 1);
    const currentApy = vault.apy;

    // Calculate projected yields
    const projectedYield1d = depositValueUsd * (currentApy / 365);
    const projectedYield7d = depositValueUsd * (currentApy / 365) * 7;
    const projectedYield30d = depositValueUsd * (currentApy / 365) * 30;
    const projectedYield1y = depositValueUsd * currentApy;

    return {
      id: `beefy-deposit-${Date.now()}`,
      protocol: DeFiProtocol.BEEFY,
      vault,
      chain,
      depositToken,
      depositAmount: amount,
      depositValueUsd,
      receiptToken: vault.receiptToken,
      expectedReceiptAmount: formatUnits(expectedShares, 18),
      expectedReceiptValueUsd: depositValueUsd,
      currentApy,
      projectedYield1d,
      projectedYield7d,
      projectedYield30d,
      projectedYield1y,
      estimatedGasUsd: 0.3,
      protocolFeeUsd: 0,
      slippageBps: 10,
      calldata,
      to: vaultAddress as Address,
      value: "0",
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    };
  }

  /**
   * Get withdraw quote
   */
  async getWithdrawQuote(
    chain: string,
    vaultAddress: string,
    sharesAmount: string,
    userAddress: string
  ): Promise<WithdrawQuote> {
    const vault = await this.getVault(chain, vaultAddress);
    
    if (!vault) {
      throw new DeFiError(
        `Vault ${vaultAddress} not found on Beefy ${chain}`,
        DeFiProtocol.BEEFY,
        "VAULT_NOT_FOUND"
      );
    }

    const client = getViemClient(chain as any);
    const parsedShares = parseUnits(sharesAmount, 18);

    // Get price per share
    const pricePerShare = await client.readContract({
      address: vaultAddress as Address,
      abi: BEEFY_VAULT_ABI,
      functionName: "getPricePerFullShare",
    }) as bigint;

    // Calculate expected assets
    const expectedAssets = (parsedShares * pricePerShare) / BigInt(1e18);

    // Build withdraw calldata
    const calldata = encodeFunctionData({
      abi: BEEFY_VAULT_ABI,
      functionName: "withdraw",
      args: [parsedShares],
    });

    const withdrawAmount = formatUnits(expectedAssets, vault.depositToken.decimals);
    const withdrawValueUsd = Number(withdrawAmount) * (vault.depositToken.priceUsd || 1);

    return {
      id: `beefy-withdraw-${Date.now()}`,
      protocol: DeFiProtocol.BEEFY,
      vault,
      chain,
      receiptToken: vault.receiptToken!,
      receiptAmount: sharesAmount,
      receiptValueUsd: withdrawValueUsd,
      withdrawToken: vault.depositToken,
      expectedWithdrawAmount: withdrawAmount,
      expectedWithdrawValueUsd: withdrawValueUsd,
      estimatedGasUsd: 0.3,
      protocolFeeUsd: 0,
      slippageBps: 10,
      instantWithdrawAvailable: true,
      calldata,
      to: vaultAddress as Address,
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    };
  }

  /**
   * Get user positions
   */
  async getPositions(chain: string, userAddress: string): Promise<DeFiPosition[]> {
    const vaults = await this.getVaults(chain);
    const client = getViemClient(chain as any);
    const positions: DeFiPosition[] = [];

    // Batch read balance calls
    const balanceCalls = vaults.map((vault) => ({
      address: vault.address as Address,
      abi: BEEFY_VAULT_ABI,
      functionName: "balanceOf" as const,
      args: [userAddress as Address],
    }));

    try {
      // Note: Using 'as any' to work around viem type strictness
      const balances = await client.multicall({ contracts: balanceCalls } as any);

      for (let i = 0; i < vaults.length; i++) {
        const vault = vaults[i];
        const balanceResult = balances[i];
        
        if (balanceResult.status !== "success" || balanceResult.result === 0n) {
          continue;
        }

        const shares = balanceResult.result as bigint;

        // Get price per share for this vault
        const pricePerShare = await client.readContract({
          address: vault.address as Address,
          abi: BEEFY_VAULT_ABI,
          functionName: "getPricePerFullShare",
        } as any) as bigint;

        const assets = (shares * pricePerShare) / BigInt(1e18);
        const sharesFormatted = formatUnits(shares, 18);
        const assetsFormatted = formatUnits(assets, vault.depositToken.decimals);
        const currentValueUsd = Number(assetsFormatted) * (vault.depositToken.priceUsd || 1);

        positions.push({
          id: `beefy-pos-${chain}-${vault.address}-${userAddress}`,
          userId: userAddress,
          walletAddress: userAddress as Address,
          protocol: DeFiProtocol.BEEFY,
          vault,
          chain,
          depositToken: vault.depositToken,
          depositedAmount: assetsFormatted,
          depositedValueUsd: currentValueUsd,
          receiptToken: vault.receiptToken,
          receiptAmount: sharesFormatted,
          currentValueUsd,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
          realizedPnl: 0,
          totalEarned: 0,
          enteredAt: Date.now(),
          lastUpdated: Date.now(),
        });
      }
    } catch (error) {
      console.error("Error fetching Beefy positions:", error);
    }

    return positions;
  }

  /**
   * Get a specific position
   */
  async getPosition(
    chain: string,
    vaultAddress: string,
    userAddress: string
  ): Promise<DeFiPosition | null> {
    const positions = await this.getPositions(chain, userAddress);
    return positions.find(
      (p) => p.vault.address.toLowerCase() === vaultAddress.toLowerCase()
    ) || null;
  }
}

// ============================================================
// Export singleton
// ============================================================

export const beefyProvider = new BeefyProvider();
export default beefyProvider;
