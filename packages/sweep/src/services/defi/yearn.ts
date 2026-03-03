/**
 * Yearn V3 Protocol Integration
 * Deposit assets into Yearn V3 vaults for auto-compounding yield
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
// Yearn V3 Contract Addresses & APIs
// ============================================================

const YEARN_API_BASE = "https://api.yearn.fi/v1";
const YEARN_VAULTS_API = "https://ydaemon.yearn.fi";

const YEARN_SUPPORTED_CHAINS: Record<string, { chainId: number; name: string }> = {
  ethereum: { chainId: 1, name: "Ethereum" },
  arbitrum: { chainId: 42161, name: "Arbitrum" },
  polygon: { chainId: 137, name: "Polygon" },
  base: { chainId: 8453, name: "Base" },
  optimism: { chainId: 10, name: "Optimism" },
};

// ============================================================
// ABIs
// ============================================================

const YEARN_VAULT_ABI = [
  {
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    name: "deposit",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    name: "redeem",
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
    ],
    name: "redeem",
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "assets", type: "uint256" }],
    name: "convertToShares",
    outputs: [{ name: "shares", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "shares", type: "uint256" }],
    name: "convertToAssets",
    outputs: [{ name: "assets", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAssets",
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
    name: "pricePerShare",
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
    name: "asset",
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
    inputs: [{ name: "receiver", type: "address" }],
    name: "maxDeposit",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ============================================================
// API Response Types
// ============================================================

interface YearnVaultResponse {
  address: string;
  name: string;
  symbol: string;
  version: string;
  decimals: number;
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  tvl: {
    totalAssets: string;
    tvl: number;
    price: number;
  };
  apy: {
    type: string;
    gross_apr: number;
    net_apy: number;
    fees: {
      performance: number;
      management: number;
    };
    points: {
      week_ago: number;
      month_ago: number;
      inception: number;
    };
  };
  strategies: {
    address: string;
    name: string;
    description: string;
  }[];
  endorsed: boolean;
  kind: string;
  category: string;
  staking: {
    available: boolean;
    address?: string;
  };
  migration: {
    available: boolean;
    address?: string;
  };
  featuringScore: number;
}

// ============================================================
// Helper Functions
// ============================================================

function getChainIdForYearn(chain: string): number {
  return YEARN_SUPPORTED_CHAINS[chain]?.chainId || 0;
}

function mapRiskLevel(version: string, endorsed: boolean): RiskLevel {
  if (endorsed && version.startsWith("3")) {
    return RiskLevel.LOW;
  } else if (endorsed) {
    return RiskLevel.MEDIUM;
  }
  return RiskLevel.HIGH;
}

// ============================================================
// Yearn Provider Implementation
// ============================================================

export class YearnProvider implements DeFiProvider {
  protocol = DeFiProtocol.YEARN;
  name = "Yearn V3";
  supportedChains = Object.keys(YEARN_SUPPORTED_CHAINS);

  /**
   * Fetch vaults from Yearn API
   */
  private async fetchVaultsFromApi(chainId: number): Promise<YearnVaultResponse[]> {
    try {
      const response = await fetch(
        `${YEARN_VAULTS_API}/${chainId}/vaults/all?hideAlways=true&orderBy=tvl&orderDirection=desc`
      );
      
      if (!response.ok) {
        throw new Error(`Yearn API error: ${response.status}`);
      }

      return response.json() as Promise<YearnVaultResponse[]>;
    } catch (error) {
      console.error("Error fetching Yearn vaults:", error);
      return [];
    }
  }

  /**
   * Get all Yearn vaults on a chain
   */
  async getVaults(chain: string): Promise<YieldVault[]> {
    const chainConfig = YEARN_SUPPORTED_CHAINS[chain];
    if (!chainConfig) {
      return [];
    }

    const cacheKey = `yearn:vaults:${chain}`;

    return cacheGetOrFetch(cacheKey, async () => {
      const apiVaults = await this.fetchVaultsFromApi(chainConfig.chainId);
      
      const vaults: YieldVault[] = apiVaults
        .filter((v) => v.endorsed && v.tvl.tvl > 10000) // Filter endorsed vaults with TVL > $10k
        .map((v) => {
          const depositAsset: DeFiAsset = {
            address: v.token.address as Address,
            symbol: v.token.symbol,
            name: v.token.name,
            decimals: v.token.decimals,
            chain,
            priceUsd: v.tvl.price,
          };

          const receiptAsset: DeFiAsset = {
            address: v.address as Address,
            symbol: v.symbol,
            name: v.name,
            decimals: v.decimals,
            chain,
          };

          const vault: YieldVault = {
            id: `yearn-${chain}-${v.address.toLowerCase()}`,
            protocol: DeFiProtocol.YEARN,
            productType: DeFiProductType.VAULT,
            name: v.name,
            symbol: v.symbol,
            address: v.address as Address,
            chain,
            chainId: chainConfig.chainId,
            depositToken: depositAsset,
            receiptToken: receiptAsset,
            apy: v.apy.net_apy,
            apyBase: v.apy.gross_apr - (v.apy.fees.performance * v.apy.gross_apr),
            apyReward: 0,
            tvlUsd: v.tvl.tvl,
            riskLevel: mapRiskLevel(v.version, v.endorsed),
            audited: v.endorsed,
            active: true,
            strategy: v.strategies[0]?.name,
            strategyAddress: v.strategies[0]?.address as Address,
            performanceFee: v.apy.fees.performance,
            managementFee: v.apy.fees.management,
            description: v.strategies[0]?.description,
            lastUpdated: Date.now(),
          };

          return vault;
        });

      return vaults;
    }, 300); // Cache for 5 minutes
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
   * Get APY data for a vault
   */
  async getApy(chain: string, vaultAddress: string): Promise<ApyData> {
    const vault = await this.getVault(chain, vaultAddress);
    
    if (!vault) {
      throw new DeFiError(
        `Vault ${vaultAddress} not found on Yearn ${chain}`,
        DeFiProtocol.YEARN,
        "VAULT_NOT_FOUND"
      );
    }

    return {
      protocol: DeFiProtocol.YEARN,
      vault: vaultAddress,
      chain,
      asset: vault.depositToken.address.toString(),
      apy: vault.apy,
      apyBase: vault.apyBase || vault.apy,
      apyReward: vault.apyReward || 0,
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
        `Vault ${vaultAddress} not found on Yearn ${chain}`,
        DeFiProtocol.YEARN,
        "VAULT_NOT_FOUND"
      );
    }

    const client = getViemClient(chain as any);
    const depositToken = vault.depositToken;
    const parsedAmount = parseUnits(amount, depositToken.decimals);

    // Get expected shares
    const expectedShares = await client.readContract({
      address: vaultAddress as Address,
      abi: YEARN_VAULT_ABI,
      functionName: "convertToShares",
      args: [parsedAmount],
    }) as bigint;

    // Check max deposit
    const maxDeposit = await client.readContract({
      address: vaultAddress as Address,
      abi: YEARN_VAULT_ABI,
      functionName: "maxDeposit",
      args: [userAddress as Address],
    }) as bigint;

    if (parsedAmount > maxDeposit) {
      throw new DeFiError(
        `Deposit amount exceeds max: ${formatUnits(maxDeposit, depositToken.decimals)}`,
        DeFiProtocol.YEARN,
        "EXCEEDS_MAX_DEPOSIT"
      );
    }

    // Build deposit calldata
    const calldata = encodeFunctionData({
      abi: YEARN_VAULT_ABI,
      functionName: "deposit",
      args: [parsedAmount, userAddress as Address],
    });

    const depositValueUsd = Number(amount) * (depositToken.priceUsd || 1);
    const currentApy = vault.apy;

    // Calculate projected yields
    const projectedYield1d = depositValueUsd * (currentApy / 365);
    const projectedYield7d = depositValueUsd * (currentApy / 365) * 7;
    const projectedYield30d = depositValueUsd * (currentApy / 365) * 30;
    const projectedYield1y = depositValueUsd * currentApy;

    return {
      id: `yearn-deposit-${Date.now()}`,
      protocol: DeFiProtocol.YEARN,
      vault,
      chain,
      depositToken,
      depositAmount: amount,
      depositValueUsd,
      receiptToken: vault.receiptToken,
      expectedReceiptAmount: formatUnits(expectedShares, vault.receiptToken!.decimals),
      expectedReceiptValueUsd: depositValueUsd, // Approximately equal
      currentApy,
      projectedYield1d,
      projectedYield7d,
      projectedYield30d,
      projectedYield1y,
      estimatedGasUsd: 0.5,
      protocolFeeUsd: 0, // Fees taken from yield
      slippageBps: 10, // Small slippage possible
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
        `Vault ${vaultAddress} not found on Yearn ${chain}`,
        DeFiProtocol.YEARN,
        "VAULT_NOT_FOUND"
      );
    }

    const client = getViemClient(chain as any);
    const receiptToken = vault.receiptToken!;
    const parsedShares = parseUnits(sharesAmount, receiptToken.decimals);

    // Get expected assets
    const expectedAssets = await client.readContract({
      address: vaultAddress as Address,
      abi: YEARN_VAULT_ABI,
      functionName: "convertToAssets",
      args: [parsedShares],
    }) as bigint;

    // Build redeem calldata with 1% max loss
    const maxLoss = 100n; // 1% in basis points
    const calldata = encodeFunctionData({
      abi: YEARN_VAULT_ABI,
      functionName: "redeem",
      args: [parsedShares, userAddress as Address, userAddress as Address, maxLoss],
    });

    const withdrawAmount = formatUnits(expectedAssets, vault.depositToken.decimals);
    const withdrawValueUsd = Number(withdrawAmount) * (vault.depositToken.priceUsd || 1);
    const sharesValueUsd = Number(sharesAmount) * (vault.depositToken.priceUsd || 1);

    return {
      id: `yearn-withdraw-${Date.now()}`,
      protocol: DeFiProtocol.YEARN,
      vault,
      chain,
      receiptToken,
      receiptAmount: sharesAmount,
      receiptValueUsd: sharesValueUsd,
      withdrawToken: vault.depositToken,
      expectedWithdrawAmount: withdrawAmount,
      expectedWithdrawValueUsd: withdrawValueUsd,
      estimatedGasUsd: 0.5,
      protocolFeeUsd: 0,
      slippageBps: 100, // 1% max loss
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

    for (const vault of vaults) {
      try {
        const shares = await client.readContract({
          address: vault.address as Address,
          abi: YEARN_VAULT_ABI,
          functionName: "balanceOf",
          args: [userAddress as Address],
        }) as bigint;

        if (shares === 0n) continue;

        const assets = await client.readContract({
          address: vault.address as Address,
          abi: YEARN_VAULT_ABI,
          functionName: "convertToAssets",
          args: [shares],
        }) as bigint;

        const sharesFormatted = formatUnits(shares, vault.receiptToken!.decimals);
        const assetsFormatted = formatUnits(assets, vault.depositToken.decimals);
        const currentValueUsd = Number(assetsFormatted) * (vault.depositToken.priceUsd || 1);

        positions.push({
          id: `yearn-pos-${chain}-${vault.address}-${userAddress}`,
          userId: userAddress,
          walletAddress: userAddress as Address,
          protocol: DeFiProtocol.YEARN,
          vault,
          chain,
          depositToken: vault.depositToken,
          depositedAmount: assetsFormatted, // Underlying asset value
          depositedValueUsd: currentValueUsd,
          receiptToken: vault.receiptToken,
          receiptAmount: sharesFormatted,
          currentValueUsd,
          unrealizedPnl: 0, // Would need entry price
          unrealizedPnlPercent: 0,
          realizedPnl: 0,
          totalEarned: 0,
          enteredAt: Date.now(),
          lastUpdated: Date.now(),
        });
      } catch (error) {
        console.error(`Error fetching Yearn position for ${vault.address}:`, error);
      }
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

export const yearnProvider = new YearnProvider();
export default yearnProvider;
