/**
 * USDs Stablecoin MCP Tools
 */

import { z } from 'zod';
import { CONTRACTS, getRebaseStateString } from '../config.js';
import { 
  readContract, 
  multicall,
  USDs_ABI, 
  RebaseManager_ABI,
  Dripper_ABI,
  Vault_ABI,
} from '../blockchain.js';
import { 
  formatUnits, 
  formatPercentage, 
  formatUSD, 
  calculateProjectedEarnings,
} from '../utils.js';
import type { Address } from 'viem';

// ============================================================================
// Tool Schemas
// ============================================================================

export const UsdsGetInfoSchema = z.object({});

export const UsdsGetBalanceSchema = z.object({
  address: z.string().describe('Ethereum address to check balance for'),
});

export const UsdsGetRebaseStateSchema = z.object({
  address: z.string().describe('Ethereum address to check rebase state'),
});

export const UsdsEstimateMintSchema = z.object({
  collateral: z.string().describe('Collateral token symbol (USDC, USDT, DAI, FRAX)'),
  amount: z.string().describe('Amount of collateral to mint with'),
});

export const UsdsEstimateRedeemSchema = z.object({
  amount: z.string().describe('Amount of USDs to redeem'),
  collateral: z.string().describe('Collateral token to receive (USDC, USDT, DAI, FRAX)'),
});

export const UsdsGetMintParamsSchema = z.object({});

export const UsdsGetYieldInfoSchema = z.object({});

export const UsdsGetCollateralRatioSchema = z.object({});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Get USDs token overview
 */
export async function usdsGetInfo(): Promise<object> {
  const [
    totalSupply,
    nonRebasingSupply,
    creditsPerToken,
  ] = await multicall<[bigint, bigint, bigint]>([
    { address: CONTRACTS.USDS as Address, abi: USDs_ABI, functionName: 'totalSupply' },
    { address: CONTRACTS.USDS as Address, abi: USDs_ABI, functionName: 'nonRebasingSupply' },
    { address: CONTRACTS.USDS as Address, abi: USDs_ABI, functionName: 'rebasingCreditsPerToken' },
  ]);

  const [aprCap, lastRebaseTime] = await multicall<[bigint, bigint]>([
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'aprCap' },
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'lastRebaseTime' },
  ]);

  const totalSupplyFormatted = formatUnits(totalSupply, 18);
  const rebasingSupply = totalSupply - nonRebasingSupply;
  const aprCapFormatted = Number(aprCap) / 100; // Assuming basis points

  return {
    token: {
      name: 'Sperax USD',
      symbol: 'USDs',
      address: CONTRACTS.USDS,
      decimals: 18,
    },
    supply: {
      total: totalSupplyFormatted,
      totalUSD: formatUSD(Number(totalSupplyFormatted)),
      rebasing: formatUnits(rebasingSupply, 18),
      nonRebasing: formatUnits(nonRebasingSupply, 18),
    },
    yield: {
      currentAPR: formatPercentage(aprCapFormatted),
      mechanism: 'Auto-rebase (no claiming required)',
      distribution: '70% to holders, 30% to SPA buyback',
    },
    lastRebase: {
      timestamp: Number(lastRebaseTime),
      date: new Date(Number(lastRebaseTime) * 1000).toISOString(),
    },
    creditsPerToken: creditsPerToken.toString(),
  };
}

/**
 * Get USDs balance for an address
 */
export async function usdsGetBalance(params: z.infer<typeof UsdsGetBalanceSchema>): Promise<object> {
  const address = params.address as Address;
  
  const [balance, creditsData, rebaseState] = await multicall<[bigint, [bigint, bigint], number]>([
    { address: CONTRACTS.USDS as Address, abi: USDs_ABI, functionName: 'balanceOf', args: [address] },
    { address: CONTRACTS.USDS as Address, abi: USDs_ABI, functionName: 'creditsBalanceOf', args: [address] },
    { address: CONTRACTS.USDS as Address, abi: USDs_ABI, functionName: 'rebaseState', args: [address] },
  ]);

  const [credits, creditsPerToken] = creditsData;
  const balanceFormatted = formatUnits(balance, 18);

  return {
    address: params.address,
    balance: balanceFormatted,
    balanceUSD: formatUSD(Number(balanceFormatted)),
    credits: {
      amount: credits.toString(),
      perToken: creditsPerToken.toString(),
    },
    rebaseState: {
      code: rebaseState,
      description: getRebaseStateString(rebaseState),
      receivesYield: rebaseState !== 1, // OptOut = 1
    },
  };
}

/**
 * Get rebase state for an address
 */
export async function usdsGetRebaseState(params: z.infer<typeof UsdsGetRebaseStateSchema>): Promise<object> {
  const address = params.address as Address;
  
  const rebaseState = await readContract({
    address: CONTRACTS.USDS as Address,
    abi: USDs_ABI,
    functionName: 'rebaseState',
    args: [address],
  }) as number;

  return {
    address: params.address,
    state: {
      code: rebaseState,
      name: rebaseState === 0 ? 'NotSet' : rebaseState === 1 ? 'OptOut' : 'OptIn',
      description: getRebaseStateString(rebaseState),
    },
    receivesYield: rebaseState !== 1,
    explanation: rebaseState === 0 
      ? 'Address has not explicitly set rebase preference. EOAs default to receiving rebases, contracts default to not receiving.'
      : rebaseState === 1
      ? 'Address has opted out of rebases. Balance will not increase from yield distribution.'
      : 'Address has opted into rebases. Balance automatically increases as yield is distributed.',
  };
}

/**
 * Get current mint parameters
 */
export async function usdsGetMintParams(): Promise<object> {
  const [mintFee, redeemFee] = await multicall<[bigint, bigint]>([
    { address: CONTRACTS.VAULT as Address, abi: Vault_ABI, functionName: 'mintFee' },
    { address: CONTRACTS.VAULT as Address, abi: Vault_ABI, functionName: 'redeemFee' },
  ]);

  return {
    mint: {
      fee: formatPercentage(Number(mintFee) / 100),
      feeRaw: mintFee.toString(),
      minimumAmount: '1 USDs',
    },
    redeem: {
      fee: formatPercentage(Number(redeemFee) / 100),
      feeRaw: redeemFee.toString(),
    },
    supportedCollaterals: ['USDC', 'USDCe', 'USDT', 'DAI', 'FRAX'],
    notes: [
      'Minting is 1:1 with supported stablecoins',
      'Fees may vary by collateral type',
      'Large mints may have slippage from oracle prices',
      'USDC.e (bridged USDC) is also supported',
    ],
  };
}

/**
 * Get current yield information
 */
export async function usdsGetYieldInfo(): Promise<object> {
  const [aprCap, aprBottom, gap, lastRebaseTime] = await multicall<[bigint, bigint, bigint, bigint]>([
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'aprCap' },
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'aprBottom' },
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'gap' },
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'lastRebaseTime' },
  ]);

  const [dripPeriod, lastDripTime, amountPerPeriod] = await multicall<[bigint, bigint, bigint]>([
    { address: CONTRACTS.DRIPPER as Address, abi: Dripper_ABI, functionName: 'dripPeriod' },
    { address: CONTRACTS.DRIPPER as Address, abi: Dripper_ABI, functionName: 'lastDripTime' },
    { address: CONTRACTS.DRIPPER as Address, abi: Dripper_ABI, functionName: 'amountPerPeriod' },
  ]);

  const currentAPR = Number(aprCap) / 100;
  const example = calculateProjectedEarnings(10000, currentAPR, 365);

  return {
    currentYield: {
      apr: formatPercentage(currentAPR),
      aprRaw: aprCap.toString(),
      aprCap: formatPercentage(Number(aprCap) / 100),
      aprBottom: formatPercentage(Number(aprBottom) / 100),
    },
    rebaseManager: {
      gap: gap.toString(),
      lastRebase: new Date(Number(lastRebaseTime) * 1000).toISOString(),
    },
    dripper: {
      period: `${Number(dripPeriod) / 3600} hours`,
      lastDrip: new Date(Number(lastDripTime) * 1000).toISOString(),
      amountPerPeriod: formatUnits(amountPerPeriod, 18),
    },
    distribution: {
      toHolders: '70%',
      toBuyback: '30%',
    },
    example: {
      principal: formatUSD(10000),
      apr: formatPercentage(currentAPR),
      dailyYield: formatUSD(example.daily),
      yearlyYield: formatUSD(example.total),
      note: 'Yield compounds automatically via rebase',
    },
  };
}

/**
 * Get collateral ratio
 */
export async function usdsGetCollateralRatio(): Promise<object> {
  const [totalSupply, tvl] = await multicall<[bigint, bigint]>([
    { address: CONTRACTS.USDS as Address, abi: USDs_ABI, functionName: 'totalSupply' },
    { address: CONTRACTS.VAULT as Address, abi: Vault_ABI, functionName: 'totalValueLocked' },
  ]);

  const supplyNum = Number(formatUnits(totalSupply, 18));
  const tvlNum = Number(formatUnits(tvl, 18));
  const ratio = tvlNum / supplyNum;

  return {
    collateralization: {
      ratio: formatPercentage(ratio * 100),
      ratioRaw: ratio.toFixed(4),
      status: ratio >= 1 ? 'Fully Collateralized' : 'Under Collateralized',
    },
    metrics: {
      totalSupply: formatUSD(supplyNum),
      totalValueLocked: formatUSD(tvlNum),
      excessCollateral: formatUSD(Math.max(0, tvlNum - supplyNum)),
    },
    health: ratio >= 1.1 ? 'Excellent' : ratio >= 1 ? 'Good' : 'Warning',
  };
}

/**
 * Get detailed rebase parameters from RebaseManager
 */
export const UsdsGetRebaseParamsSchema = z.object({});

export async function usdsGetRebaseParams(): Promise<object> {
  const [
    aprCap,
    aprBottom,
    gap,
    lastRebaseTS,
  ] = await multicall<[bigint, bigint, bigint, bigint]>([
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'aprCap' },
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'aprBottom' },
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'gap' },
    { address: CONTRACTS.REBASE_MANAGER as Address, abi: RebaseManager_ABI, functionName: 'lastRebaseTS' },
  ]);

  // Try to get available rebase amount
  let availableRebaseAmt: bigint = BigInt(0);
  let minRebaseAmt: bigint = BigInt(0);
  let maxRebaseAmt: bigint = BigInt(0);
  
  try {
    availableRebaseAmt = await readContract({
      address: CONTRACTS.REBASE_MANAGER as Address,
      abi: RebaseManager_ABI,
      functionName: 'getAvailableRebaseAmt',
    }) as bigint;

    const [minMax] = await multicall<[[bigint, bigint]]>([
      { 
        address: CONTRACTS.REBASE_MANAGER as Address, 
        abi: RebaseManager_ABI, 
        functionName: 'getMinAndMaxRebaseAmt' 
      },
    ]);
    [minRebaseAmt, maxRebaseAmt] = minMax;
  } catch {
    // Functions may not be available
  }

  const gapSeconds = Number(gap);
  const lastRebaseTimestamp = Number(lastRebaseTS);
  const nextRebaseTime = lastRebaseTimestamp + gapSeconds;
  const now = Math.floor(Date.now() / 1000);
  const canRebaseIn = Math.max(0, nextRebaseTime - now);

  return {
    aprLimits: {
      cap: {
        basisPoints: Number(aprCap),
        percentage: `${Number(aprCap) / 100}%`,
        description: 'Maximum APR that can be distributed',
      },
      bottom: {
        basisPoints: Number(aprBottom),
        percentage: `${Number(aprBottom) / 100}%`,
        description: 'Minimum APR floor',
      },
    },
    timing: {
      gapSeconds: gapSeconds,
      gapHours: gapSeconds / 3600,
      description: `Minimum ${gapSeconds / 3600} hours between rebases`,
      lastRebase: {
        timestamp: lastRebaseTimestamp,
        date: new Date(lastRebaseTimestamp * 1000).toISOString(),
      },
      nextRebase: {
        timestamp: nextRebaseTime,
        date: new Date(nextRebaseTime * 1000).toISOString(),
        canRebaseIn: canRebaseIn > 0 ? `${Math.floor(canRebaseIn / 3600)}h ${Math.floor((canRebaseIn % 3600) / 60)}m` : 'Now',
      },
    },
    availableRebase: {
      amount: formatUnits(availableRebaseAmt, 18),
      min: formatUnits(minRebaseAmt, 18),
      max: formatUnits(maxRebaseAmt, 18),
      note: 'Amount available for next rebase based on Dripper balance',
    },
    contracts: {
      rebaseManager: CONTRACTS.REBASE_MANAGER,
      dripper: CONTRACTS.DRIPPER,
      usds: CONTRACTS.USDS,
    },
  };
}

// ============================================================================
// Tool Definitions for MCP
// ============================================================================

export const usdsTools = [
  {
    name: 'usds_get_info',
    description: 'Get USDs stablecoin overview including total supply, current APR, and last rebase time',
    schema: UsdsGetInfoSchema,
    handler: usdsGetInfo,
  },
  {
    name: 'usds_get_balance',
    description: 'Get USDs balance for a specific address including credits and rebase state',
    schema: UsdsGetBalanceSchema,
    handler: usdsGetBalance,
  },
  {
    name: 'usds_get_rebase_state',
    description: 'Check if an address receives yield rebases (Opt-In, Opt-Out, or NotSet)',
    schema: UsdsGetRebaseStateSchema,
    handler: usdsGetRebaseState,
  },
  {
    name: 'usds_get_mint_params',
    description: 'Get current mint and redeem parameters including fees and supported collaterals',
    schema: UsdsGetMintParamsSchema,
    handler: usdsGetMintParams,
  },
  {
    name: 'usds_get_yield_info',
    description: 'Get current yield metrics including APR, drip rate, and yield distribution',
    schema: UsdsGetYieldInfoSchema,
    handler: usdsGetYieldInfo,
  },
  {
    name: 'usds_get_collateral_ratio',
    description: 'Get current protocol collateralization ratio and health status',
    schema: UsdsGetCollateralRatioSchema,
    handler: usdsGetCollateralRatio,
  },
  {
    name: 'usds_get_rebase_params',
    description: 'Get detailed rebase parameters from RebaseManager including APR limits, timing, and available rebase amount',
    schema: UsdsGetRebaseParamsSchema,
    handler: usdsGetRebaseParams,
  },
];
