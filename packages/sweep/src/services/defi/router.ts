/**
 * DeFi Router Service
 * Routes dust tokens to optimal DeFi destinations based on preferences
 */

import { type Address, formatUnits, parseUnits } from "viem";
import {
  DeFiProtocol,
  DeFiProductType,
  RiskLevel,
  type DeFiVault,
  type DeFiRoute,
  type RoutePreference,
  type DepositQuote,
  type DeFiAsset,
  DeFiError,
} from "./types.js";
import { defiAggregator, type DeFiAggregator } from "./index.js";
import { cacheGetOrFetch } from "../../utils/redis.js";

// ============================================================
// Types
// ============================================================

interface RouteResult {
  route: DeFiRoute;
  quote: DepositQuote;
  score: number;
}

interface MultiAssetRoute {
  assets: {
    asset: DeFiAsset;
    amount: string;
    route: RouteResult;
  }[];
  totalValueUsd: number;
  totalProjectedYield1y: number;
  avgApy: number;
  estimatedTotalGasUsd: number;
}

interface SwapStep {
  type: "swap";
  fromToken: DeFiAsset;
  toToken: DeFiAsset;
  amount: string;
  protocol: string;
  estimatedOutput: string;
}

interface DepositStep {
  type: "deposit";
  token: DeFiAsset;
  amount: string;
  protocol: DeFiProtocol;
  vault: DeFiVault;
  expectedShares: string;
}

type RouteStep = SwapStep | DepositStep;

interface DetailedRoute {
  id: string;
  chain: string;
  userAddress: string;
  inputAsset: DeFiAsset;
  inputAmount: string;
  inputValueUsd: number;
  outputVault: DeFiVault;
  steps: RouteStep[];
  totalGasUsd: number;
  expectedApy: number;
  projectedYield1y: number;
  riskLevel: RiskLevel;
  score: number;
}

// ============================================================
// Router Configuration
// ============================================================

const DEFAULT_PREFERENCES: RoutePreference = {
  maxRiskLevel: RiskLevel.MEDIUM,
  minApy: 0.01, // 1% minimum
  minTvl: 100000, // $100k minimum TVL
  preferCompounding: true,
  maxGasPercent: 0.05, // Max 5% gas vs deposit
  optimizeFor: "apy",
};

// Stablecoin addresses for consolidation routing
const STABLECOINS: Record<string, Record<string, Address>> = {
  ethereum: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EesedCdAE3C1F",
  },
  arbitrum: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "USDC.e": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  },
  polygon: {
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "USDC.e": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    USDbC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  },
  optimism: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    "USDC.e": "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  },
};

// Native staking token addresses
const NATIVE_STAKING: Record<string, { symbol: string; protocol: DeFiProtocol }> = {
  ethereum: { symbol: "ETH", protocol: DeFiProtocol.LIDO },
  solana: { symbol: "SOL", protocol: DeFiProtocol.JITO },
};

// ============================================================
// DeFi Router Implementation
// ============================================================

export class DeFiRouter {
  private aggregator: DeFiAggregator;

  constructor(aggregator: DeFiAggregator = defiAggregator) {
    this.aggregator = aggregator;
  }

  /**
   * Find best route for a single dust token
   */
  async findBestRoute(
    chain: string,
    assetAddress: string,
    amount: string,
    userAddress: string,
    preferences: Partial<RoutePreference> = {}
  ): Promise<RouteResult | null> {
    const prefs = { ...DEFAULT_PREFERENCES, ...preferences };

    // Check if this is a native token that can be staked directly
    const nativeStaking = NATIVE_STAKING[chain];
    if (nativeStaking && this.isNativeToken(assetAddress)) {
      return this.routeToNativeStaking(
        chain,
        amount,
        userAddress,
        nativeStaking.protocol,
        prefs
      );
    }

    // Find all vaults that accept this asset
    const comparison = await this.aggregator.findBestYield(chain, assetAddress, prefs);

    if (comparison.vaults.length === 0) {
      // No direct vaults - check if we should consolidate to stablecoin
      return this.routeViaConsolidation(chain, assetAddress, amount, userAddress, prefs);
    }

    // Get quotes for top vaults
    const routePromises = comparison.vaults.slice(0, 5).map(async (vaultMeta) => {
      try {
        const quote = await this.aggregator.getDepositQuote(
          vaultMeta.protocol,
          chain,
          vaultMeta.vault.address,
          amount,
          userAddress
        );

        // Check gas limit
        const gasPercent = quote.estimatedGasUsd / quote.depositValueUsd;
        if (gasPercent > prefs.maxGasPercent!) {
          return null;
        }

        const route: DeFiRoute = {
          id: `route-${Date.now()}-${vaultMeta.vault.address}`,
          chain,
          inputToken: vaultMeta.vault.depositToken,
          inputAmount: amount,
          outputVault: vaultMeta.vault,
          expectedApy: vaultMeta.apy,
          estimatedGasUsd: quote.estimatedGasUsd,
          steps: [
            {
              type: "deposit",
              protocol: vaultMeta.protocol,
              vault: vaultMeta.vault.address as Address,
              token: vaultMeta.vault.depositToken.address as Address,
              amount,
            },
          ],
          totalSteps: 1,
          requiresApproval: true,
        };

        return {
          route,
          quote,
          score: vaultMeta.score * (1 - gasPercent), // Penalize high gas
        };
      } catch (error) {
        console.error(`Error getting quote for ${vaultMeta.vault.address}:`, error);
        return null;
      }
    });

    const results = (await Promise.all(routePromises)).filter(
      (r): r is RouteResult => r !== null
    );

    if (results.length === 0) {
      return null;
    }

    // Return best scored route
    return results.reduce((a, b) => (a.score > b.score ? a : b));
  }

  /**
   * Check if address is native token
   */
  private isNativeToken(address: string): boolean {
    const nativeAddresses = [
      "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      "0x0000000000000000000000000000000000000000",
      "So11111111111111111111111111111111111111112", // Wrapped SOL mint
    ];
    return nativeAddresses.includes(address);
  }

  /**
   * Route native token to staking protocol
   */
  private async routeToNativeStaking(
    chain: string,
    amount: string,
    userAddress: string,
    protocol: DeFiProtocol,
    prefs: RoutePreference
  ): Promise<RouteResult | null> {
    try {
      const provider = this.aggregator.getProvider(protocol);
      const vaults = await provider.getVaults(chain);

      if (vaults.length === 0) {
        return null;
      }

      // Get primary staking vault
      const stakingVault = vaults[0];

      const quote = await provider.getDepositQuote(
        chain,
        stakingVault.address,
        amount,
        userAddress
      );

      const gasPercent = quote.estimatedGasUsd / quote.depositValueUsd;
      if (gasPercent > prefs.maxGasPercent!) {
        return null;
      }

      const route: DeFiRoute = {
        id: `route-stake-${Date.now()}`,
        chain,
        inputToken: stakingVault.depositToken,
        inputAmount: amount,
        outputVault: stakingVault,
        expectedApy: stakingVault.apy,
        estimatedGasUsd: quote.estimatedGasUsd,
        steps: [
          {
            type: "stake",
            protocol,
            vault: stakingVault.address as Address,
            token: stakingVault.depositToken.address as Address,
            amount,
          },
        ],
        totalSteps: 1,
        requiresApproval: false, // Native token
      };

      // Score staking options highly for native tokens
      const score = 0.9 * (1 - gasPercent);

      return { route, quote, score };
    } catch (error) {
      console.error(`Error routing to native staking:`, error);
      return null;
    }
  }

  /**
   * Route dust via consolidation to stablecoin vault
   */
  private async routeViaConsolidation(
    chain: string,
    assetAddress: string,
    amount: string,
    userAddress: string,
    prefs: RoutePreference
  ): Promise<RouteResult | null> {
    const chainStables = STABLECOINS[chain];
    if (!chainStables) {
      return null;
    }

    // Default to USDC as consolidation target
    const targetStable = chainStables.USDC || Object.values(chainStables)[0];
    if (!targetStable) {
      return null;
    }

    // Find best vault for target stablecoin
    const comparison = await this.aggregator.findBestYield(chain, targetStable, prefs);

    if (!comparison.bestRiskAdjusted) {
      return null;
    }

    const bestVault = comparison.bestRiskAdjusted;

    // Note: Would need DEX aggregator integration for actual swap
    // This is a placeholder route showing the structure
    const inputAsset: DeFiAsset = {
      address: assetAddress as Address,
      symbol: "DUST",
      name: "Dust Token",
      decimals: 18,
      chain,
    };

    const route: DeFiRoute = {
      id: `route-consolidate-${Date.now()}`,
      chain,
      inputToken: inputAsset,
      inputAmount: amount,
      outputVault: bestVault.vault,
      expectedApy: bestVault.apy,
      estimatedGasUsd: 2.0, // Swap + deposit
      steps: [
        {
          type: "swap",
          protocol: "1inch", // Or other DEX aggregator
          token: assetAddress as Address,
          targetToken: targetStable,
          amount,
        },
        {
          type: "deposit",
          protocol: bestVault.protocol,
          vault: bestVault.vault.address as Address,
          token: targetStable,
          amount: "estimated", // Would be calculated from swap quote
        },
      ],
      totalSteps: 2,
      requiresApproval: true,
    };

    // Lower score for consolidation routes due to swap risk
    const score = bestVault.score * 0.8;

    // Create placeholder quote
    const quote: DepositQuote = {
      id: `consolidate-quote-${Date.now()}`,
      protocol: bestVault.protocol,
      vault: bestVault.vault,
      chain,
      depositToken: bestVault.vault.depositToken,
      depositAmount: "0", // Would come from swap quote
      depositValueUsd: 0,
      receiptToken: bestVault.vault.receiptToken,
      expectedReceiptAmount: "0",
      expectedReceiptValueUsd: 0,
      currentApy: bestVault.apy,
      projectedYield1d: 0,
      projectedYield7d: 0,
      projectedYield30d: 0,
      projectedYield1y: 0,
      estimatedGasUsd: 2.0,
      protocolFeeUsd: 0,
      slippageBps: 50,
      calldata: "0x" as any,
      to: bestVault.vault.address as Address,
      value: "0",
      expiresAt: Date.now() + 5 * 60 * 1000,
      createdAt: Date.now(),
    };

    return { route, quote, score };
  }

  /**
   * Find routes for multiple dust tokens
   */
  async findMultiAssetRoute(
    chain: string,
    assets: { address: string; amount: string; valueUsd: number }[],
    userAddress: string,
    preferences: Partial<RoutePreference> = {}
  ): Promise<MultiAssetRoute> {
    const routePromises = assets.map(async (asset) => {
      const route = await this.findBestRoute(
        chain,
        asset.address,
        asset.amount,
        userAddress,
        preferences
      );

      return {
        asset: {
          address: asset.address as Address,
          symbol: "DUST",
          name: "Dust Token",
          decimals: 18,
          chain,
          priceUsd: asset.valueUsd / Number(asset.amount),
        } as DeFiAsset,
        amount: asset.amount,
        route,
      };
    });

    const results = await Promise.all(routePromises);

    const validRoutes = results.filter(
      (r): r is { asset: DeFiAsset; amount: string; route: RouteResult } =>
        r.route !== null
    );

    const totalValueUsd = validRoutes.reduce(
      (sum, r) => sum + (r.route.quote.depositValueUsd || 0),
      0
    );

    const totalProjectedYield1y = validRoutes.reduce(
      (sum, r) => sum + (r.route.quote.projectedYield1y || 0),
      0
    );

    const avgApy = totalValueUsd > 0 ? totalProjectedYield1y / totalValueUsd : 0;

    const estimatedTotalGasUsd = validRoutes.reduce(
      (sum, r) => sum + (r.route.quote.estimatedGasUsd || 0),
      0
    );

    return {
      assets: validRoutes,
      totalValueUsd,
      totalProjectedYield1y,
      avgApy,
      estimatedTotalGasUsd,
    };
  }

  /**
   * Get recommended destination for dust consolidation
   */
  async getRecommendedDestination(
    chain: string,
    totalValueUsd: number,
    preferences: Partial<RoutePreference> = {}
  ): Promise<{
    vault: DeFiVault;
    protocol: DeFiProtocol;
    apy: number;
    reason: string;
  } | null> {
    const prefs = { ...DEFAULT_PREFERENCES, ...preferences };

    // For small amounts, prioritize gas efficiency
    if (totalValueUsd < 100) {
      // Find staking options first (usually lower gas)
      const staking = await this.aggregator.getStakingOptions(chain);
      const validStaking = staking.filter(
        (s) => this.getRiskLevelValue(s.riskLevel) <= this.getRiskLevelValue(prefs.maxRiskLevel!)
      );

      if (validStaking.length > 0) {
        const best = validStaking.reduce((a, b) => (a.apy > b.apy ? a : b));
        return {
          vault: best,
          protocol: best.protocol,
          apy: best.apy,
          reason: "Best staking option for small amounts (lower gas)",
        };
      }
    }

    // For larger amounts, find best risk-adjusted yield
    const allVaults = await this.aggregator.getAllVaults(chain);
    const validVaults = allVaults.filter((v) => {
      if (this.getRiskLevelValue(v.riskLevel) > this.getRiskLevelValue(prefs.maxRiskLevel!)) {
        return false;
      }
      if ((v.tvlUsd || 0) < (prefs.minTvl || 0)) {
        return false;
      }
      if (v.apy < (prefs.minApy || 0)) {
        return false;
      }
      return true;
    });

    if (validVaults.length === 0) {
      return null;
    }

    // Score vaults
    const scored = validVaults.map((v) => ({
      vault: v,
      score: this.scoreVault(v, prefs),
    }));

    const best = scored.reduce((a, b) => (a.score > b.score ? a : b));

    let reason = "Best risk-adjusted yield";
    if (best.vault.productType === DeFiProductType.VAULT) {
      reason = "Best auto-compounding vault";
    } else if (best.vault.productType === DeFiProductType.LENDING) {
      reason = "Best lending rate";
    } else if (best.vault.productType === DeFiProductType.STAKING) {
      reason = "Best staking rewards";
    }

    return {
      vault: best.vault,
      protocol: best.vault.protocol,
      apy: best.vault.apy,
      reason,
    };
  }

  /**
   * Score a vault based on preferences
   */
  private scoreVault(vault: DeFiVault, prefs: RoutePreference): number {
    let score = 0;

    // APY component (40%)
    score += Math.min(vault.apy / 0.20, 1) * 0.4;

    // TVL component (30%)
    const tvlScore = Math.min(Math.log10((vault.tvlUsd || 1000) / 1000) / 5, 1);
    score += tvlScore * 0.3;

    // Risk component (20%)
    const riskScore = 1 - (this.getRiskLevelValue(vault.riskLevel) - 1) / 4;
    score += riskScore * 0.2;

    // Audit bonus (10%)
    if (vault.audited) {
      score += 0.1;
    }

    // Preference bonuses
    if (prefs.preferCompounding && vault.productType === DeFiProductType.VAULT) {
      score *= 1.1;
    }

    if (prefs.preferredProtocols?.includes(vault.protocol)) {
      score *= 1.15;
    }

    if (prefs.excludedProtocols?.includes(vault.protocol)) {
      score = 0;
    }

    return score;
  }

  /**
   * Get numeric value for risk level
   */
  private getRiskLevelValue(level: RiskLevel): number {
    const levels: Record<RiskLevel, number> = {
      [RiskLevel.MINIMAL]: 1,
      [RiskLevel.LOW]: 2,
      [RiskLevel.MEDIUM]: 3,
      [RiskLevel.HIGH]: 4,
      [RiskLevel.CRITICAL]: 5,
      [RiskLevel.DEGEN]: 6,
    };
    return levels[level] || 3;
  }
}

// ============================================================
// Export singleton
// ============================================================

export const defiRouter = new DeFiRouter();
export default defiRouter;
