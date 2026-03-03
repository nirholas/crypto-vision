/**
 * SPA Token and Staking MCP Tools
 */

import { z } from 'zod';
import { CONTRACTS } from '../config.js';
import { 
  readContract, 
  multicall,
  SPA_ABI, 
  VeSPA_ABI,
  XSpa_ABI,
  SPABuyback_ABI,
} from '../blockchain.js';
import { 
  formatUnits, 
  formatPercentage, 
  calculateVeSPAPower,
  calculateXSPARedemption,
  calculateRedemptionRatio,
  calculateTimeUntil,
  formatDate,
} from '../utils.js';
import type { Address } from 'viem';

// ============================================================================
// Tool Schemas
// ============================================================================

export const SpaGetInfoSchema = z.object({});

export const SpaGetBalanceSchema = z.object({
  address: z.string().describe('Ethereum address to check SPA balance'),
});

export const VespaGetPositionSchema = z.object({
  address: z.string().describe('Ethereum address to check veSPA position'),
});

export const VespaCalculatePowerSchema = z.object({
  amount: z.string().describe('Amount of SPA to lock'),
  days: z.number().min(7).max(1460).describe('Lock duration in days (7-1460)'),
});

export const VespaGetStatsSchema = z.object({});

export const XspaGetPositionSchema = z.object({
  address: z.string().describe('Ethereum address to check xSPA position'),
});

export const XspaCalculateRedemptionSchema = z.object({
  amount: z.string().describe('Amount of xSPA to redeem'),
  days: z.number().min(15).max(180).describe('Vesting period in days (15-180)'),
});

export const BuybackGetStatsSchema = z.object({});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Get SPA token overview
 */
export async function spaGetInfo(): Promise<object> {
  const [totalSupply, name, symbol, decimals] = await multicall<[bigint, string, string, number]>([
    { address: CONTRACTS.SPA as Address, abi: SPA_ABI, functionName: 'totalSupply' },
    { address: CONTRACTS.SPA as Address, abi: SPA_ABI, functionName: 'name' },
    { address: CONTRACTS.SPA as Address, abi: SPA_ABI, functionName: 'symbol' },
    { address: CONTRACTS.SPA as Address, abi: SPA_ABI, functionName: 'decimals' },
  ]);

  const [vespaTotalSupply, vespaLocked] = await multicall<[bigint, bigint]>([
    { address: CONTRACTS.VESPA as Address, abi: VeSPA_ABI, functionName: 'totalSupply' },
    { address: CONTRACTS.VESPA as Address, abi: VeSPA_ABI, functionName: 'supply' },
  ]);

  const totalSupplyFormatted = formatUnits(totalSupply, 18);
  const lockedFormatted = formatUnits(vespaLocked, 18);

  return {
    token: {
      name,
      symbol,
      address: CONTRACTS.SPA,
      decimals,
    },
    supply: {
      total: totalSupplyFormatted,
      circulating: 'Query CoinGecko for live data',
    },
    staking: {
      totalLocked: lockedFormatted,
      percentLocked: formatPercentage(
        (Number(vespaLocked) / Number(totalSupply)) * 100
      ),
      veSPATotalSupply: formatUnits(vespaTotalSupply, 18),
    },
    tokenomics: {
      mechanism: 'Buyback & Burn',
      source: '30% of protocol yield',
      beneficiaries: 'veSPA holders get governance power',
    },
    links: {
      arbitrumExplorer: `https://arbiscan.io/token/${CONTRACTS.SPA}`,
      website: 'https://sperax.io',
    },
  };
}

/**
 * Get SPA balance for an address
 */
export async function spaGetBalance(params: z.infer<typeof SpaGetBalanceSchema>): Promise<object> {
  const address = params.address as Address;
  
  const [spaBalance, vespaBalance, xspaBalance] = await multicall<[bigint, bigint, bigint]>([
    { address: CONTRACTS.SPA as Address, abi: SPA_ABI, functionName: 'balanceOf', args: [address] },
    { address: CONTRACTS.VESPA as Address, abi: VeSPA_ABI, functionName: 'balanceOf', args: [address] },
    { address: CONTRACTS.XSPA as Address, abi: XSpa_ABI, functionName: 'balanceOf', args: [address] },
  ]);

  return {
    address: params.address,
    balances: {
      SPA: {
        amount: formatUnits(spaBalance, 18),
        description: 'Liquid SPA tokens',
      },
      veSPA: {
        amount: formatUnits(vespaBalance, 18),
        description: 'Vote-escrowed SPA (locked)',
      },
      xSPA: {
        amount: formatUnits(xspaBalance, 18),
        description: 'Reward token (redeemable for SPA)',
      },
    },
    summary: {
      totalSPAEquivalent: 'Calculate based on lock positions',
    },
  };
}

/**
 * Get veSPA lock position for an address
 */
export async function vespaGetPosition(params: z.infer<typeof VespaGetPositionSchema>): Promise<object> {
  const address = params.address as Address;
  
  const [lockedData, votingPower] = await multicall<[[bigint, bigint], bigint]>([
    { address: CONTRACTS.VESPA as Address, abi: VeSPA_ABI, functionName: 'locked', args: [address] },
    { address: CONTRACTS.VESPA as Address, abi: VeSPA_ABI, functionName: 'balanceOf', args: [address] },
  ]);

  const [lockedAmount, unlockTime] = lockedData;
  const now = Math.floor(Date.now() / 1000);
  const daysRemaining = Math.max(0, Math.floor((Number(unlockTime) - now) / 86400));

  return {
    address: params.address,
    position: {
      lockedSPA: formatUnits(lockedAmount, 18),
      votingPower: formatUnits(votingPower, 18),
      unlockTime: Number(unlockTime),
      unlockDate: formatDate(Number(unlockTime)),
      timeUntilUnlock: calculateTimeUntil(Number(unlockTime)),
      daysRemaining,
    },
    status: Number(lockedAmount) === 0 
      ? 'No Active Lock' 
      : Number(unlockTime) <= now 
      ? 'Unlocked (Ready to Withdraw)' 
      : 'Active Lock',
    multiplier: daysRemaining > 0 ? (daysRemaining / 365).toFixed(2) + 'x' : '0x',
  };
}

/**
 * Calculate veSPA voting power for a potential lock
 */
export async function vespaCalculatePower(params: z.infer<typeof VespaCalculatePowerSchema>): Promise<object> {
  const amount = Number(params.amount);
  const days = params.days;
  
  const votingPower = calculateVeSPAPower(amount, days);
  const multiplier = days / 365;

  return {
    input: {
      spaAmount: params.amount,
      lockDuration: `${days} days`,
      lockDurationYears: (days / 365).toFixed(2),
    },
    result: {
      veSPAReceived: votingPower.toFixed(4),
      multiplier: multiplier.toFixed(4) + 'x',
    },
    formula: {
      description: 'veSPA = SPA × (lockDays / 365)',
      calculation: `${amount} × (${days} / 365) = ${votingPower.toFixed(4)}`,
    },
    comparison: {
      '7 days (min)': calculateVeSPAPower(amount, 7).toFixed(2),
      '1 year': calculateVeSPAPower(amount, 365).toFixed(2),
      '2 years': calculateVeSPAPower(amount, 730).toFixed(2),
      '4 years (max)': calculateVeSPAPower(amount, 1460).toFixed(2),
    },
    notes: [
      'Voting power decays linearly as unlock time approaches',
      'You can extend your lock or add more SPA anytime',
      'Early unlock is not possible - SPA is locked until expiry',
    ],
  };
}

/**
 * Get global veSPA stats
 */
export async function vespaGetStats(): Promise<object> {
  const [totalSupply, totalLocked] = await multicall<[bigint, bigint]>([
    { address: CONTRACTS.VESPA as Address, abi: VeSPA_ABI, functionName: 'totalSupply' },
    { address: CONTRACTS.VESPA as Address, abi: VeSPA_ABI, functionName: 'supply' },
  ]);

  const [spaSupply] = await multicall<[bigint]>([
    { address: CONTRACTS.SPA as Address, abi: SPA_ABI, functionName: 'totalSupply' },
  ]);

  const lockedNum = Number(formatUnits(totalLocked, 18));
  const spaSupplyNum = Number(formatUnits(spaSupply, 18));
  const avgMultiplier = Number(totalSupply) / Number(totalLocked);

  return {
    global: {
      totalVeSPA: formatUnits(totalSupply, 18),
      totalSPALocked: formatUnits(totalLocked, 18),
      percentOfSupplyLocked: formatPercentage((lockedNum / spaSupplyNum) * 100),
      averageMultiplier: avgMultiplier.toFixed(2) + 'x',
      estimatedAverageLock: `${Math.round(avgMultiplier * 365)} days`,
    },
    benefits: [
      'Governance voting power',
      'Protocol fee sharing (future)',
      'Boosted farming rewards (future)',
    ],
    contracts: {
      veSPA: CONTRACTS.VESPA,
    },
  };
}

/**
 * Get xSPA position for an address
 */
export async function xspaGetPosition(params: z.infer<typeof XspaGetPositionSchema>): Promise<object> {
  const address = params.address as Address;
  
  const balance = await readContract({
    address: CONTRACTS.XSPA as Address,
    abi: XSpa_ABI,
    functionName: 'balanceOf',
    args: [address],
  }) as bigint;

  const balanceNum = Number(formatUnits(balance, 18));

  return {
    address: params.address,
    position: {
      xSPABalance: formatUnits(balance, 18),
    },
    redemptionOptions: {
      '15 days (min)': {
        spaReceived: calculateXSPARedemption(balanceNum, 15).toFixed(2),
        ratio: formatPercentage(calculateRedemptionRatio(15) * 100),
      },
      '30 days': {
        spaReceived: calculateXSPARedemption(balanceNum, 30).toFixed(2),
        ratio: formatPercentage(calculateRedemptionRatio(30) * 100),
      },
      '90 days': {
        spaReceived: calculateXSPARedemption(balanceNum, 90).toFixed(2),
        ratio: formatPercentage(calculateRedemptionRatio(90) * 100),
      },
      '180 days (max)': {
        spaReceived: calculateXSPARedemption(balanceNum, 180).toFixed(2),
        ratio: formatPercentage(calculateRedemptionRatio(180) * 100),
      },
    },
    explanation: 'xSPA is earned from staking rewards. Redeem for SPA with 15-180 day vesting. Longer vest = more SPA.',
  };
}

/**
 * Calculate xSPA to SPA redemption
 */
export async function xspaCalculateRedemption(params: z.infer<typeof XspaCalculateRedemptionSchema>): Promise<object> {
  const amount = Number(params.amount);
  const days = params.days;
  
  const spaReceived = calculateXSPARedemption(amount, days);
  const ratio = calculateRedemptionRatio(days);

  return {
    input: {
      xSPAAmount: params.amount,
      vestingPeriod: `${days} days`,
    },
    result: {
      spaReceived: spaReceived.toFixed(4),
      redemptionRatio: formatPercentage(ratio * 100),
      forfeited: (amount - spaReceived).toFixed(4),
    },
    formula: {
      description: 'SPA_out = xSPA × (vestingDays + 150) / 330',
      calculation: `${amount} × (${days} + 150) / 330 = ${spaReceived.toFixed(4)}`,
    },
    comparison: {
      '15 days': {
        ratio: '50%',
        spa: calculateXSPARedemption(amount, 15).toFixed(2),
      },
      '180 days': {
        ratio: '100%',
        spa: calculateXSPARedemption(amount, 180).toFixed(2),
      },
    },
    recommendation: days < 90 
      ? 'Consider a longer vesting period for more SPA' 
      : days >= 180 
      ? 'Maximum redemption ratio achieved!' 
      : 'Good balance of time and redemption ratio',
  };
}

/**
 * Get buyback and burn stats
 */
export async function buybackGetStats(): Promise<object> {
  // Note: These function names are placeholders - actual contract may differ
  try {
    const [totalBurned, pendingBurn] = await multicall<[bigint, bigint]>([
      { address: CONTRACTS.SPA_BUYBACK as Address, abi: SPABuyback_ABI, functionName: 'totalBurned' },
      { address: CONTRACTS.SPA_BUYBACK as Address, abi: SPABuyback_ABI, functionName: 'pendingBurn' },
    ]);

    return {
      buybackProgram: {
        status: 'Active',
        source: '30% of all protocol yield',
        mechanism: 'Automated market buyback → Burn',
      },
      stats: {
        totalBurned: formatUnits(totalBurned, 18),
        pendingBurn: formatUnits(pendingBurn, 18),
      },
      contracts: {
        SPABuyback: CONTRACTS.SPA_BUYBACK,
        YieldReserve: CONTRACTS.YIELD_RESERVE,
      },
      impact: 'Deflationary pressure on SPA supply',
    };
  } catch {
    return {
      buybackProgram: {
        status: 'Active',
        source: '30% of all protocol yield',
        mechanism: 'Automated market buyback → Burn',
      },
      note: 'Detailed stats unavailable - contract interface may have changed',
      contracts: {
        SPABuyback: CONTRACTS.SPA_BUYBACK,
        YieldReserve: CONTRACTS.YIELD_RESERVE,
      },
    };
  }
}

// ============================================================================
// Tool Definitions for MCP
// ============================================================================

export const spaTools = [
  {
    name: 'spa_get_info',
    description: 'Get SPA token overview including supply, staking stats, and tokenomics',
    schema: SpaGetInfoSchema,
    handler: spaGetInfo,
  },
  {
    name: 'spa_get_balance',
    description: 'Get all SPA-related balances (SPA, veSPA, xSPA) for an address',
    schema: SpaGetBalanceSchema,
    handler: spaGetBalance,
  },
  {
    name: 'vespa_get_position',
    description: 'Get veSPA lock position including locked amount, voting power, and unlock time',
    schema: VespaGetPositionSchema,
    handler: vespaGetPosition,
  },
  {
    name: 'vespa_calculate_power',
    description: 'Calculate veSPA voting power for a potential lock amount and duration',
    schema: VespaCalculatePowerSchema,
    handler: vespaCalculatePower,
  },
  {
    name: 'vespa_get_stats',
    description: 'Get global veSPA statistics including total locked and average lock duration',
    schema: VespaGetStatsSchema,
    handler: vespaGetStats,
  },
  {
    name: 'xspa_get_position',
    description: 'Get xSPA balance and redemption options for an address',
    schema: XspaGetPositionSchema,
    handler: xspaGetPosition,
  },
  {
    name: 'xspa_calculate_redemption',
    description: 'Calculate SPA received from xSPA redemption with different vesting periods',
    schema: XspaCalculateRedemptionSchema,
    handler: xspaCalculateRedemption,
  },
  {
    name: 'buyback_get_stats',
    description: 'Get SPA buyback and burn program statistics',
    schema: BuybackGetStatsSchema,
    handler: buybackGetStats,
  },
];
