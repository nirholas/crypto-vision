/**
 * DeFi Aggregator Service
 * Aggregates multiple DeFi protocols to find best yields
 */

import {
  DeFiProtocol,
  DeFiProductType,
  RiskLevel,
  type DeFiProvider,
  type DeFiVault,
  type YieldVault,
  type StakingPool,
  type LendingPool,
  type ApyData,
  type DepositQuote,
  type WithdrawQuote,
  type DeFiPosition,
  type DeFiRoute,
  type RoutePreference,
  DeFiError,
  DEFI_CHAIN_CONFIG,
} from "./types.js";
import { aaveProvider } from "./aave.js";
import { yearnProvider } from "./yearn.js";
import { beefyProvider } from "./beefy.js";
import { lidoProvider } from "./lido.js";
import { jitoProvider } from "./jito.js";
import { cacheGetOrFetch } from "../../utils/redis.js";

// ============================================================
// Provider Registry
// ============================================================

// Only include implemented providers
const IMPLEMENTED_PROVIDERS: Partial<Record<DeFiProtocol, DeFiProvider>> = {
  [DeFiProtocol.AAVE]: aaveProvider,
  [DeFiProtocol.YEARN]: yearnProvider,
  [DeFiProtocol.BEEFY]: beefyProvider,
  [DeFiProtocol.LIDO]: lidoProvider,
  [DeFiProtocol.JITO]: jitoProvider,
};

// ============================================================
// Types
// ============================================================

interface VaultWithMeta extends DeFiVault {
  provider: DeFiProvider;
}

interface AggregatedVault {
  vault: DeFiVault;
  protocol: DeFiProtocol;
  chain: string;
  apy: number;
  tvlUsd: number;
  riskLevel: RiskLevel;
  score: number;
}

interface YieldComparison {
  asset: string;
  chain: string;
  vaults: AggregatedVault[];
  bestApy: AggregatedVault | null;
  bestRiskAdjusted: AggregatedVault | null;
  highestTvl: AggregatedVault | null;
}

// ============================================================
// DeFi Aggregator Implementation
// ============================================================

export class DeFiAggregator {
  private providers: Map<DeFiProtocol, DeFiProvider>;

  constructor() {
    this.providers = new Map(
      Object.entries(IMPLEMENTED_PROVIDERS)
        .filter(([_, provider]) => provider !== undefined)
        .map(([key, provider]) => [key as DeFiProtocol, provider!])
    );
  }

  /**
   * Get a specific provider
   */
  getProvider(protocol: DeFiProtocol): DeFiProvider {
    const provider = this.providers.get(protocol);
    if (!provider) {
      throw new DeFiError(
        `Provider not found: ${protocol}`,
        protocol,
        "PROVIDER_NOT_FOUND"
      );
    }
    return provider;
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): string[] {
    return Object.keys(DEFI_CHAIN_CONFIG);
  }

  /**
   * Get all supported protocols
   */
  getSupportedProtocols(): DeFiProtocol[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get protocols available on a chain
   */
  getProtocolsForChain(chain: string): DeFiProtocol[] {
    const protocols: DeFiProtocol[] = [];
    
    for (const [protocol, provider] of this.providers) {
      if (provider.supportedChains.includes(chain)) {
        protocols.push(protocol);
      }
    }

    return protocols;
  }

  /**
   * Get all vaults across all protocols on a chain
   */
  async getAllVaults(chain: string): Promise<DeFiVault[]> {
    const cacheKey = `aggregator:vaults:${chain}`;

    return cacheGetOrFetch(cacheKey, async () => {
      const protocols = this.getProtocolsForChain(chain);
      const vaultPromises = protocols.map(async (protocol) => {
        try {
          const provider = this.getProvider(protocol);
          return await provider.getVaults(chain);
        } catch (error) {
          console.error(`Error fetching vaults from ${protocol}:`, error);
          return [];
        }
      });

      const results = await Promise.all(vaultPromises);
      return results.flat();
    }, 300);
  }

  /**
   * Get vaults for a specific asset across all protocols
   */
  async getVaultsForAsset(
    chain: string,
    assetAddress: string
  ): Promise<AggregatedVault[]> {
    const allVaults = await this.getAllVaults(chain);
    const assetLower = assetAddress.toLowerCase();

    const matchingVaults = allVaults.filter((vault) => {
      if (!vault.depositToken) return false;
      return vault.depositToken.address.toLowerCase() === assetLower;
    });

    return this.scoreVaults(matchingVaults);
  }

  /**
   * Score vaults based on multiple factors
   */
  private scoreVaults(vaults: DeFiVault[]): AggregatedVault[] {
    return vaults.map((vault) => {
      // Calculate risk-adjusted score
      const riskMultiplier = this.getRiskMultiplier(vault.riskLevel);
      const tvlScore = Math.min(Math.log10(vault.tvlUsd || 1) / 10, 1); // Normalize TVL
      const apyScore = Math.min(vault.apy / 0.20, 1); // Normalize APY (cap at 20%)
      
      // Combined score: 50% APY, 30% TVL, 20% risk adjustment
      const score = (apyScore * 0.5 + tvlScore * 0.3) * riskMultiplier;

      return {
        vault,
        protocol: vault.protocol,
        chain: vault.chain,
        apy: vault.apy,
        tvlUsd: vault.tvlUsd || 0,
        riskLevel: vault.riskLevel,
        score,
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Get risk multiplier for scoring
   */
  private getRiskMultiplier(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case RiskLevel.MINIMAL:
        return 1.0;
      case RiskLevel.LOW:
        return 0.95;
      case RiskLevel.MEDIUM:
        return 0.8;
      case RiskLevel.HIGH:
        return 0.6;
      case RiskLevel.CRITICAL:
        return 0.4;
      case RiskLevel.DEGEN:
        return 0.3;
      default:
        return 0.7;
    }
  }

  /**
   * Find best yield for an asset
   */
  async findBestYield(
    chain: string,
    assetAddress: string,
    preferences?: RoutePreference
  ): Promise<YieldComparison> {
    const vaults = await this.getVaultsForAsset(chain, assetAddress);

    // Apply preference filters
    let filteredVaults = vaults;
    
    if (preferences) {
      if (preferences.maxRiskLevel) {
        const maxRisk = this.getRiskLevelValue(preferences.maxRiskLevel);
        filteredVaults = filteredVaults.filter(
          (v) => this.getRiskLevelValue(v.riskLevel) <= maxRisk
        );
      }
      
      if (preferences.minTvl) {
        filteredVaults = filteredVaults.filter(
          (v) => v.tvlUsd >= preferences.minTvl!
        );
      }
      
      if (preferences.preferredProtocols && preferences.preferredProtocols.length > 0) {
        filteredVaults = filteredVaults.filter(
          (v) => preferences.preferredProtocols!.includes(v.protocol)
        );
      }
      
      if (preferences.excludedProtocols && preferences.excludedProtocols.length > 0) {
        filteredVaults = filteredVaults.filter(
          (v) => !preferences.excludedProtocols!.includes(v.protocol)
        );
      }
    }

    // Find best options
    const bestApy = filteredVaults.length > 0
      ? filteredVaults.reduce((a, b) => a.apy > b.apy ? a : b)
      : null;

    const bestRiskAdjusted = filteredVaults.length > 0
      ? filteredVaults.reduce((a, b) => a.score > b.score ? a : b)
      : null;

    const highestTvl = filteredVaults.length > 0
      ? filteredVaults.reduce((a, b) => a.tvlUsd > b.tvlUsd ? a : b)
      : null;

    return {
      asset: assetAddress,
      chain,
      vaults: filteredVaults,
      bestApy,
      bestRiskAdjusted,
      highestTvl,
    };
  }

  /**
   * Get numeric value for risk level comparison
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

  /**
   * Get APY comparison across protocols for an asset
   */
  async compareApys(
    chain: string,
    assetAddress: string
  ): Promise<Record<DeFiProtocol, ApyData | null>> {
    const vaults = await this.getVaultsForAsset(chain, assetAddress);
    const result: Record<DeFiProtocol, ApyData | null> = {} as any;

    for (const protocol of this.getSupportedProtocols()) {
      const protocolVault = vaults.find((v) => v.protocol === protocol);
      
      if (protocolVault) {
        result[protocol] = {
          protocol,
          vault: protocolVault.vault.address,
          chain,
          asset: assetAddress,
          apy: protocolVault.apy,
          apyBase: protocolVault.vault.apyBase || protocolVault.apy,
          apyReward: protocolVault.vault.apyReward || 0,
          lastUpdated: Date.now(),
        };
      } else {
        result[protocol] = null;
      }
    }

    return result;
  }

  /**
   * Get deposit quote from a specific protocol
   */
  async getDepositQuote(
    protocol: DeFiProtocol,
    chain: string,
    vaultAddress: string,
    amount: string,
    userAddress: string
  ): Promise<DepositQuote> {
    const provider = this.getProvider(protocol);
    return provider.getDepositQuote(chain, vaultAddress, amount, userAddress);
  }

  /**
   * Get withdraw quote from a specific protocol
   */
  async getWithdrawQuote(
    protocol: DeFiProtocol,
    chain: string,
    vaultAddress: string,
    amount: string,
    userAddress: string
  ): Promise<WithdrawQuote> {
    const provider = this.getProvider(protocol);
    return provider.getWithdrawQuote(chain, vaultAddress, amount, userAddress);
  }

  /**
   * Get all user positions across all protocols
   */
  async getAllPositions(
    chain: string,
    userAddress: string
  ): Promise<DeFiPosition[]> {
    const protocols = this.getProtocolsForChain(chain);
    const positionPromises = protocols.map(async (protocol) => {
      try {
        const provider = this.getProvider(protocol);
        return await provider.getPositions(chain, userAddress);
      } catch (error) {
        console.error(`Error fetching positions from ${protocol}:`, error);
        return [];
      }
    });

    const results = await Promise.all(positionPromises);
    return results.flat();
  }

  /**
   * Get total portfolio value across all protocols
   */
  async getPortfolioValue(
    chains: string[],
    userAddress: string
  ): Promise<{
    totalValueUsd: number;
    byChain: Record<string, number>;
    byProtocol: Record<DeFiProtocol, number>;
    positions: DeFiPosition[];
  }> {
    const allPositions: DeFiPosition[] = [];
    const byChain: Record<string, number> = {};
    const byProtocol: Record<DeFiProtocol, number> = {} as any;

    for (const chain of chains) {
      const positions = await this.getAllPositions(chain, userAddress);
      allPositions.push(...positions);

      const chainValue = positions.reduce((sum, p) => sum + p.currentValueUsd, 0);
      byChain[chain] = chainValue;

      for (const position of positions) {
        byProtocol[position.protocol] = (byProtocol[position.protocol] || 0) + position.currentValueUsd;
      }
    }

    const totalValueUsd = Object.values(byChain).reduce((sum, v) => sum + v, 0);

    return {
      totalValueUsd,
      byChain,
      byProtocol,
      positions: allPositions,
    };
  }

  /**
   * Get top vaults by APY across all chains
   */
  async getTopVaultsByApy(
    limit: number = 10,
    productType?: DeFiProductType
  ): Promise<AggregatedVault[]> {
    const cacheKey = `aggregator:top:apy:${productType || 'all'}:${limit}`;

    return cacheGetOrFetch(cacheKey, async () => {
      const chains = this.getSupportedChains();
      const allVaults: DeFiVault[] = [];

      for (const chain of chains) {
        try {
          const vaults = await this.getAllVaults(chain);
          allVaults.push(...vaults);
        } catch (error) {
          console.error(`Error fetching vaults for ${chain}:`, error);
        }
      }

      let filteredVaults = allVaults;
      
      if (productType) {
        filteredVaults = filteredVaults.filter((v) => v.productType === productType);
      }

      const scored = this.scoreVaults(filteredVaults);
      return scored.sort((a, b) => b.apy - a.apy).slice(0, limit);
    }, 300);
  }

  /**
   * Get staking options (Lido, Jito, etc.)
   */
  async getStakingOptions(chain: string): Promise<StakingPool[]> {
    const allVaults = await this.getAllVaults(chain);
    return allVaults.filter(
      (v) => v.productType === DeFiProductType.STAKING
    ) as StakingPool[];
  }

  /**
   * Get lending options (Aave, etc.)
   */
  async getLendingOptions(chain: string): Promise<LendingPool[]> {
    const allVaults = await this.getAllVaults(chain);
    return allVaults.filter(
      (v) => v.productType === DeFiProductType.LENDING
    ) as LendingPool[];
  }

  /**
   * Get auto-compounding vaults (Yearn, Beefy)
   */
  async getVaultOptions(chain: string): Promise<YieldVault[]> {
    const allVaults = await this.getAllVaults(chain);
    return allVaults.filter(
      (v) => v.productType === DeFiProductType.VAULT
    ) as YieldVault[];
  }
}

// ============================================================
// Export singleton
// ============================================================

export const defiAggregator = new DeFiAggregator();
export default defiAggregator;

// Re-export providers
export { aaveProvider } from "./aave.js";
export { yearnProvider } from "./yearn.js";
export { beefyProvider } from "./beefy.js";
export { lidoProvider } from "./lido.js";
export { jitoProvider } from "./jito.js";

// Re-export types
export * from "./types.js";
