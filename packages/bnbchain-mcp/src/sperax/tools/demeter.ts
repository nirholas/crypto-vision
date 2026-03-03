/**
 * Demeter Yield Farming MCP Tools
 */

import { z } from 'zod';
import { CONTRACTS } from '../config.js';
import { 
  readContract, 
  multicall,
  FarmRegistry_ABI,
  Farm_ABI,
  ERC20_ABI,
} from '../blockchain.js';
import { 
  formatUnits, 
  formatPercentage, 
  formatUSD,
} from '../utils.js';
import type { Address } from 'viem';

// ============================================================================
// Tool Schemas
// ============================================================================

export const DemeterListFarmsSchema = z.object({
  minApr: z.number().optional().describe('Minimum APR filter (e.g., 20 for 20%)'),
  token: z.string().optional().describe('Filter by staking token symbol'),
  limit: z.number().optional().default(10).describe('Maximum number of farms to return'),
});

export const DemeterGetFarmDetailsSchema = z.object({
  farmAddress: z.string().describe('Address of the farm contract'),
});

export const DemeterGetUserPositionSchema = z.object({
  address: z.string().describe('User address to check farm positions'),
});

export const DemeterCalculateRewardsSchema = z.object({
  farmAddress: z.string().describe('Address of the farm contract'),
  userAddress: z.string().describe('User address to calculate rewards for'),
});

export const DemeterEstimateAprSchema = z.object({
  farmAddress: z.string().describe('Address of the farm contract'),
  depositAmount: z.string().describe('Amount to deposit (in token units)'),
});

export const DemeterGetTopFarmsSchema = z.object({
  limit: z.number().optional().default(5).describe('Number of top farms to return'),
  minApr: z.number().optional().describe('Minimum APR threshold'),
});

export const DemeterGetFarmTypesSchema = z.object({});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Farm types supported by Demeter
 */
export const FARM_TYPES = {
  UniV3: {
    name: 'Uniswap V3',
    description: 'Concentrated liquidity positions',
    features: ['Concentrated liquidity', 'Multiple fee tiers', 'NFT positions'],
  },
  CamelotV2: {
    name: 'Camelot V2',
    description: 'Legacy Camelot LP tokens',
    features: ['Standard AMM', 'Dynamic fees', 'LP tokens'],
  },
  CamelotV3: {
    name: 'Camelot V3',
    description: 'Concentrated liquidity Camelot positions',
    features: ['Concentrated liquidity', 'Arbitrum native', 'spNFT positions'],
  },
  BalancerV2: {
    name: 'Balancer V2',
    description: 'Weighted pool LP tokens',
    features: ['Multi-asset pools', 'Weighted ratios', 'Flash swaps'],
  },
} as const;

interface FarmInfo {
  address: string;
  stakingToken: string;
  rewardsToken: string;
  totalStaked: string;
  rewardRate: string;
  apr: number;
  endTime: number;
  isActive: boolean;
}

/**
 * Calculate farm APR from reward rate and TVL
 */
function calculateFarmApr(
  rewardRate: bigint,
  totalStaked: bigint,
  rewardDecimals: number,
  stakingDecimals: number,
  rewardPrice: number = 1,
  stakingPrice: number = 1
): number {
  if (totalStaked === 0n) return 0;
  
  const yearlyRewards = Number(rewardRate) * 365 * 24 * 3600;
  const yearlyRewardsValue = yearlyRewards * rewardPrice / (10 ** rewardDecimals);
  const stakedValue = Number(totalStaked) * stakingPrice / (10 ** stakingDecimals);
  
  return (yearlyRewardsValue / stakedValue) * 100;
}

/**
 * Get farm details from contract
 */
async function getFarmDetails(farmAddress: Address): Promise<FarmInfo | null> {
  try {
    const [stakingToken, rewardsToken, totalStaked, rewardRate, periodFinish] = 
      await multicall<[Address, Address, bigint, bigint, bigint]>([
        { address: farmAddress, abi: Farm_ABI, functionName: 'stakingToken' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'rewardsToken' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'totalStaked' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'rewardRate' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'periodFinish' },
      ]);

    const now = Math.floor(Date.now() / 1000);
    const isActive = Number(periodFinish) > now;
    
    // Calculate APR (simplified - assumes $1 prices)
    const apr = calculateFarmApr(rewardRate, totalStaked, 18, 18, 1, 1);

    return {
      address: farmAddress,
      stakingToken,
      rewardsToken,
      totalStaked: formatUnits(totalStaked, 18),
      rewardRate: formatUnits(rewardRate, 18),
      apr,
      endTime: Number(periodFinish),
      isActive,
    };
  } catch (error) {
    console.error(`Error fetching farm ${farmAddress}:`, error);
    return null;
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * List all active Demeter farms
 */
export async function demeterListFarms(params: z.infer<typeof DemeterListFarmsSchema>): Promise<object> {
  try {
    const farms = await readContract({
      address: CONTRACTS.FARM_REGISTRY as Address,
      abi: FarmRegistry_ABI,
      functionName: 'getAllFarms',
    }) as Address[];

    const farmDetails: FarmInfo[] = [];
    
    for (const farmAddress of farms.slice(0, 20)) { // Limit to 20 for performance
      const details = await getFarmDetails(farmAddress);
      if (details && details.isActive) {
        // Apply filters
        if (params.minApr && details.apr < params.minApr) continue;
        farmDetails.push(details);
      }
    }

    // Sort by APR descending
    farmDetails.sort((a, b) => b.apr - a.apr);
    
    // Apply limit
    const limitedFarms = farmDetails.slice(0, params.limit || 10);

    return {
      farms: limitedFarms.map(farm => ({
        address: farm.address,
        stakingToken: farm.stakingToken,
        rewardsToken: farm.rewardsToken,
        tvl: farm.totalStaked,
        apr: formatPercentage(farm.apr),
        aprRaw: farm.apr,
        status: farm.isActive ? 'Active' : 'Ended',
        endsAt: new Date(farm.endTime * 1000).toISOString(),
      })),
      summary: {
        totalFarms: farmDetails.length,
        activeFilters: {
          minApr: params.minApr ? formatPercentage(params.minApr) : 'None',
          token: params.token || 'None',
        },
      },
      registry: CONTRACTS.FARM_REGISTRY,
    };
  } catch (error) {
    return {
      error: 'Failed to fetch farms',
      message: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'The farm registry may not be accessible or has no active farms',
    };
  }
}

/**
 * Get detailed information about a specific farm
 */
export async function demeterGetFarmDetails(params: z.infer<typeof DemeterGetFarmDetailsSchema>): Promise<object> {
  const farmAddress = params.farmAddress as Address;
  
  try {
    const [stakingToken, rewardsToken, totalStaked, rewardRate, periodFinish] = 
      await multicall<[Address, Address, bigint, bigint, bigint]>([
        { address: farmAddress, abi: Farm_ABI, functionName: 'stakingToken' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'rewardsToken' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'totalStaked' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'rewardRate' },
        { address: farmAddress, abi: Farm_ABI, functionName: 'periodFinish' },
      ]);

    // Get token symbols
    const [stakingSymbol, rewardsSymbol] = await multicall<[string, string]>([
      { address: stakingToken, abi: ERC20_ABI, functionName: 'symbol' },
      { address: rewardsToken, abi: ERC20_ABI, functionName: 'symbol' },
    ]);

    const now = Math.floor(Date.now() / 1000);
    const isActive = Number(periodFinish) > now;
    const daysRemaining = isActive ? Math.floor((Number(periodFinish) - now) / 86400) : 0;
    
    const apr = calculateFarmApr(rewardRate, totalStaked, 18, 18, 1, 1);
    const dailyRewards = Number(formatUnits(rewardRate, 18)) * 86400;

    return {
      farm: {
        address: params.farmAddress,
        status: isActive ? 'Active' : 'Ended',
      },
      tokens: {
        staking: {
          address: stakingToken,
          symbol: stakingSymbol,
        },
        rewards: {
          address: rewardsToken,
          symbol: rewardsSymbol,
        },
      },
      metrics: {
        totalStaked: formatUnits(totalStaked, 18),
        tvlEstimate: formatUSD(Number(formatUnits(totalStaked, 18))),
        apr: formatPercentage(apr),
        aprRaw: apr,
        dailyRewards: dailyRewards.toFixed(2),
        rewardRate: formatUnits(rewardRate, 18) + '/second',
      },
      duration: {
        endsAt: new Date(Number(periodFinish) * 1000).toISOString(),
        daysRemaining: isActive ? daysRemaining : 0,
        status: isActive 
          ? daysRemaining > 30 ? 'Healthy Duration' : 'Ending Soon'
          : 'Reward Period Ended',
      },
    };
  } catch (error) {
    return {
      error: 'Failed to fetch farm details',
      farmAddress: params.farmAddress,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user's positions across all farms
 */
export async function demeterGetUserPosition(params: z.infer<typeof DemeterGetUserPositionSchema>): Promise<object> {
  const userAddress = params.address as Address;
  
  try {
    const farms = await readContract({
      address: CONTRACTS.FARM_REGISTRY as Address,
      abi: FarmRegistry_ABI,
      functionName: 'getAllFarms',
    }) as Address[];

    const positions: Array<{
      farm: string;
      staked: string;
      earned: string;
      stakingToken: string;
      rewardsToken: string;
    }> = [];

    for (const farmAddress of farms.slice(0, 20)) {
      try {
        const [staked, earned, stakingToken, rewardsToken] = await multicall<[bigint, bigint, Address, Address]>([
          { address: farmAddress, abi: Farm_ABI, functionName: 'balanceOf', args: [userAddress] },
          { address: farmAddress, abi: Farm_ABI, functionName: 'earned', args: [userAddress] },
          { address: farmAddress, abi: Farm_ABI, functionName: 'stakingToken' },
          { address: farmAddress, abi: Farm_ABI, functionName: 'rewardsToken' },
        ]);

        if (staked > 0n || earned > 0n) {
          positions.push({
            farm: farmAddress,
            staked: formatUnits(staked, 18),
            earned: formatUnits(earned, 18),
            stakingToken,
            rewardsToken,
          });
        }
      } catch {
        // Skip farms that error
      }
    }

    return {
      user: params.address,
      positions: positions.map(p => ({
        farmAddress: p.farm,
        stakedAmount: p.staked,
        pendingRewards: p.earned,
        stakingToken: p.stakingToken,
        rewardsToken: p.rewardsToken,
      })),
      summary: {
        totalPositions: positions.length,
        totalPendingRewards: positions.reduce(
          (sum, p) => sum + Number(p.earned), 
          0
        ).toFixed(4),
      },
      actions: positions.length > 0 
        ? ['Claim rewards', 'Stake more', 'Withdraw']
        : ['Explore available farms', 'Stake in a farm'],
    };
  } catch (error) {
    return {
      error: 'Failed to fetch user positions',
      user: params.address,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Calculate pending rewards for a user in a farm
 */
export async function demeterCalculateRewards(params: z.infer<typeof DemeterCalculateRewardsSchema>): Promise<object> {
  const farmAddress = params.farmAddress as Address;
  const userAddress = params.userAddress as Address;
  
  try {
    const [earned, staked, rewardsToken, rewardRate] = await multicall<[bigint, bigint, Address, bigint]>([
      { address: farmAddress, abi: Farm_ABI, functionName: 'earned', args: [userAddress] },
      { address: farmAddress, abi: Farm_ABI, functionName: 'balanceOf', args: [userAddress] },
      { address: farmAddress, abi: Farm_ABI, functionName: 'rewardsToken' },
      { address: farmAddress, abi: Farm_ABI, functionName: 'rewardRate' },
    ]);

    const [rewardsSymbol] = await multicall<[string]>([
      { address: rewardsToken, abi: ERC20_ABI, functionName: 'symbol' },
    ]);

    const earnedNum = Number(formatUnits(earned, 18));

    return {
      farm: params.farmAddress,
      user: params.userAddress,
      rewards: {
        pending: formatUnits(earned, 18),
        pendingUSD: formatUSD(earnedNum), // Assuming $1 for simplicity
        token: rewardsSymbol,
        tokenAddress: rewardsToken,
      },
      position: {
        staked: formatUnits(staked, 18),
      },
      projection: {
        dailyRewards: (Number(formatUnits(rewardRate, 18)) * 86400 * Number(staked) / 1e18).toFixed(4),
        note: 'Based on current reward rate and your stake',
      },
      actions: earnedNum > 0 
        ? ['Claim rewards now', 'Compound (if same token)']
        : ['Stake more to earn', 'Wait for rewards to accrue'],
    };
  } catch (error) {
    return {
      error: 'Failed to calculate rewards',
      farm: params.farmAddress,
      user: params.userAddress,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Estimate APR for a deposit amount
 */
export async function demeterEstimateApr(params: z.infer<typeof DemeterEstimateAprSchema>): Promise<object> {
  const farmAddress = params.farmAddress as Address;
  
  try {
    const [totalStaked, rewardRate, periodFinish] = await multicall<[bigint, bigint, bigint]>([
      { address: farmAddress, abi: Farm_ABI, functionName: 'totalStaked' },
      { address: farmAddress, abi: Farm_ABI, functionName: 'rewardRate' },
      { address: farmAddress, abi: Farm_ABI, functionName: 'periodFinish' },
    ]);

    const depositAmount = BigInt(Math.floor(Number(params.depositAmount) * 1e18));
    const newTotalStaked = totalStaked + depositAmount;
    
    const currentApr = calculateFarmApr(rewardRate, totalStaked, 18, 18);
    const newApr = calculateFarmApr(rewardRate, newTotalStaked, 18, 18);
    const userShare = Number(depositAmount) / Number(newTotalStaked);
    
    const dailyRewards = Number(formatUnits(rewardRate, 18)) * 86400 * userShare;
    const yearlyRewards = dailyRewards * 365;

    return {
      farm: params.farmAddress,
      deposit: {
        amount: params.depositAmount,
        shareOfPool: formatPercentage(userShare * 100),
      },
      apr: {
        current: formatPercentage(currentApr),
        afterDeposit: formatPercentage(newApr),
        impact: currentApr - newApr > 0.1 
          ? 'Significant dilution - large deposit' 
          : 'Minimal impact on APR',
      },
      projectedRewards: {
        daily: dailyRewards.toFixed(4),
        weekly: (dailyRewards * 7).toFixed(4),
        monthly: (dailyRewards * 30).toFixed(4),
        yearly: yearlyRewards.toFixed(4),
      },
      notes: [
        'APR assumes constant reward rate and TVL',
        'Actual returns may vary with market conditions',
        'Large deposits dilute APR for all participants',
      ],
    };
  } catch (error) {
    return {
      error: 'Failed to estimate APR',
      farm: params.farmAddress,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get top farms by APR
 */
export async function demeterGetTopFarms(params: z.infer<typeof DemeterGetTopFarmsSchema>): Promise<object> {
  try {
    const farms = await readContract({
      address: CONTRACTS.FARM_REGISTRY as Address,
      abi: FarmRegistry_ABI,
      functionName: 'getAllFarms',
    }) as Address[];

    const farmDetails: FarmInfo[] = [];
    
    for (const farmAddress of farms.slice(0, 30)) {
      const details = await getFarmDetails(farmAddress);
      if (details && details.isActive) {
        if (params.minApr && details.apr < params.minApr) continue;
        farmDetails.push(details);
      }
    }

    // Sort by APR descending
    farmDetails.sort((a, b) => b.apr - a.apr);
    
    const topFarms = farmDetails.slice(0, params.limit || 5);

    return {
      topFarms: topFarms.map((farm, index) => ({
        rank: index + 1,
        address: farm.address,
        apr: formatPercentage(farm.apr),
        aprRaw: farm.apr,
        tvl: farm.totalStaked,
        stakingToken: farm.stakingToken,
        rewardsToken: farm.rewardsToken,
        daysRemaining: Math.max(0, Math.floor((farm.endTime - Date.now() / 1000) / 86400)),
      })),
      summary: {
        totalActiveFarms: farmDetails.length,
        averageApr: formatPercentage(
          farmDetails.reduce((sum, f) => sum + f.apr, 0) / farmDetails.length || 0
        ),
        highestApr: formatPercentage(topFarms[0]?.apr || 0),
      },
      filters: {
        minApr: params.minApr ? formatPercentage(params.minApr) : 'None',
        limit: params.limit || 5,
      },
      disclaimer: 'APR is calculated from on-chain data. Actual returns may vary.',
    };
  } catch (error) {
    return {
      error: 'Failed to fetch top farms',
      message: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'The farm registry may not be accessible',
    };
  }
}

/**
 * Get supported farm types
 */
export async function demeterGetFarmTypes(): Promise<object> {
  return {
    farmTypes: Object.entries(FARM_TYPES).map(([key, value]) => ({
      id: key,
      name: value.name,
      description: value.description,
      features: value.features,
    })),
    summary: {
      totalTypes: Object.keys(FARM_TYPES).length,
      description: 'Demeter supports multiple AMM types for yield farming',
    },
    creationFee: {
      amount: '100 USDs',
      description: 'One-time fee to create a new farm',
    },
    contracts: {
      farmRegistry: CONTRACTS.FARM_REGISTRY,
      farmDeployer: CONTRACTS.FARM_DEPLOYER,
      rewarderFactory: CONTRACTS.REWARDER_FACTORY,
    },
    documentation: {
      overview: 'Demeter allows anyone to create no-code yield farms for any LP token',
      steps: [
        '1. Choose LP token type (UniV3, Camelot, Balancer)',
        '2. Select reward token(s)',
        '3. Set reward amount and duration',
        '4. Pay 100 USDs creation fee',
        '5. Farm goes live immediately',
      ],
    },
  };
}

// ============================================================================
// Tool Definitions for MCP
// ============================================================================

export const demeterTools = [
  {
    name: 'demeter_list_farms',
    description: 'List all active Demeter yield farms with optional APR and token filters',
    schema: DemeterListFarmsSchema,
    handler: demeterListFarms,
  },
  {
    name: 'demeter_get_farm_details',
    description: 'Get detailed information about a specific Demeter farm',
    schema: DemeterGetFarmDetailsSchema,
    handler: demeterGetFarmDetails,
  },
  {
    name: 'demeter_get_user_position',
    description: 'Get all Demeter farm positions for a user address',
    schema: DemeterGetUserPositionSchema,
    handler: demeterGetUserPosition,
  },
  {
    name: 'demeter_calculate_rewards',
    description: 'Calculate pending rewards for a user in a specific farm',
    schema: DemeterCalculateRewardsSchema,
    handler: demeterCalculateRewards,
  },
  {
    name: 'demeter_estimate_apr',
    description: 'Estimate APR impact and projected rewards for a deposit amount',
    schema: DemeterEstimateAprSchema,
    handler: demeterEstimateApr,
  },
  {
    name: 'demeter_get_top_farms',
    description: 'Get the highest APR Demeter farms sorted by yield',
    schema: DemeterGetTopFarmsSchema,
    handler: demeterGetTopFarms,
  },
  {
    name: 'demeter_get_farm_types',
    description: 'Get supported farm types (UniV3, CamelotV2, CamelotV3, BalancerV2) and creation information',
    schema: DemeterGetFarmTypesSchema,
    handler: demeterGetFarmTypes,
  },
];
