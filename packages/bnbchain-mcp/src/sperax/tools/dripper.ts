/**
 * Sperax MCP Server - Dripper Tools
 *
 * Tools for interacting with the Sperax Dripper system that manages
 * yield distribution to USDs holders through rebasing.
 */

import { z } from 'zod';
import { CONTRACTS } from '../config.js';
import { readContract, multicall, DripperABI, ERC20ABI } from '../blockchain.js';
import { formatUnits, formatPercentage } from '../utils.js';

// ============================================================================
// Input Schemas
// ============================================================================

const EstimateRebaseInput = z.object({
  usdsBalance: z
    .string()
    .describe('USDs balance to estimate rebase earnings for'),
  days: z
    .number()
    .min(1)
    .max(365)
    .optional()
    .default(30)
    .describe('Number of days to project (default: 30)'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const dripperTools = [
  {
    name: 'dripper_get_status',
    description:
      'Get current Dripper status including drip rate, pending yield, and distribution schedule. Shows how yield flows to USDs holders.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const results = await multicall([
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'dripRate',
          },
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'dripDuration',
          },
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'lastCollectTimestamp',
          },
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'availableFunds',
          },
          {
            address: CONTRACTS.USDS,
            abi: ERC20ABI,
            functionName: 'totalSupply',
          },
        ]);

        const [dripRate, dripDuration, lastCollect, availableFunds, usdsSupply] =
          results as [bigint, bigint, bigint, bigint, bigint];

        const dripRatePerSecond = Number(formatUnits(dripRate, 18));
        const dripRatePerDay = dripRatePerSecond * 86400;
        const dripRatePerYear = dripRatePerDay * 365;

        const usdsSupplyNum = Number(formatUnits(usdsSupply, 18));
        const estimatedAPY = usdsSupplyNum > 0 ? (dripRatePerYear / usdsSupplyNum) * 100 : 0;

        const lastCollectDate = new Date(Number(lastCollect) * 1000);
        const secondsSinceLastCollect = Math.floor(Date.now() / 1000) - Number(lastCollect);

        return {
          success: true,
          data: {
            dripRate: {
              perSecond: `${dripRatePerSecond.toFixed(6)} USDs`,
              perHour: `${(dripRatePerSecond * 3600).toFixed(2)} USDs`,
              perDay: `${dripRatePerDay.toFixed(2)} USDs`,
              perYear: `${dripRatePerYear.toFixed(2)} USDs`,
            },
            dripDuration: {
              seconds: Number(dripDuration),
              formatted: `${Math.floor(Number(dripDuration) / 86400)} days`,
            },
            availableFunds: {
              raw: availableFunds.toString(),
              formatted: `${formatUnits(availableFunds, 18)} USDs`,
              daysOfYield: dripRatePerDay > 0
                ? (Number(formatUnits(availableFunds, 18)) / dripRatePerDay).toFixed(1)
                : 'N/A',
            },
            lastCollection: {
              timestamp: lastCollectDate.toISOString(),
              secondsAgo: secondsSinceLastCollect,
              formatted: secondsSinceLastCollect < 3600
                ? `${Math.floor(secondsSinceLastCollect / 60)} minutes ago`
                : `${Math.floor(secondsSinceLastCollect / 3600)} hours ago`,
            },
            estimatedAPY: formatPercentage(estimatedAPY / 100),
            usdsSupply: {
              raw: usdsSupply.toString(),
              formatted: formatUnits(usdsSupply, 18),
            },
            contracts: {
              dripper: CONTRACTS.DRIPPER,
              usds: CONTRACTS.USDS,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get dripper status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'dripper_get_balance',
    description:
      'Get the current balance of yield waiting to be distributed through the Dripper. Shows pending yield in the queue.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const [availableFunds, dripRate] = await multicall([
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'availableFunds',
          },
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'dripRate',
          },
        ]) as [bigint, bigint];

        const availableFormatted = formatUnits(availableFunds, 18);
        const dripRatePerSecond = Number(formatUnits(dripRate, 18));
        const dripRatePerDay = dripRatePerSecond * 86400;

        const daysRemaining = dripRatePerDay > 0
          ? Number(availableFormatted) / dripRatePerDay
          : 0;

        return {
          success: true,
          data: {
            pendingYield: {
              raw: availableFunds.toString(),
              formatted: `${availableFormatted} USDs`,
              usd: `$${availableFormatted}`,
            },
            distribution: {
              ratePerDay: `${dripRatePerDay.toFixed(2)} USDs/day`,
              daysRemaining: daysRemaining.toFixed(1),
              estimatedEmpty: new Date(
                Date.now() + daysRemaining * 86400000
              ).toISOString(),
            },
            status: {
              isHealthy: daysRemaining > 7,
              warning: daysRemaining < 3 ? 'Low yield buffer - needs refill soon' : null,
            },
            source: 'Yield from Vault strategies',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get dripper balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'dripper_get_config',
    description:
      'Get Dripper configuration parameters including drip duration, rate limits, and governance settings.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const [dripDuration, dripRate] = await multicall([
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'dripDuration',
          },
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'dripRate',
          },
        ]) as [bigint, bigint];

        const durationDays = Number(dripDuration) / 86400;

        return {
          success: true,
          data: {
            dripDuration: {
              seconds: Number(dripDuration),
              days: durationDays.toFixed(1),
              description: 'Time over which collected yield is distributed',
            },
            dripRate: {
              perSecond: formatUnits(dripRate, 18),
              description: 'Current rate of yield distribution',
            },
            mechanism: {
              description: 'Dripper smooths yield distribution over time to provide consistent APY',
              steps: [
                '1. Strategies harvest yield from DeFi protocols',
                '2. Yield is sent to Dripper contract',
                '3. Dripper releases yield gradually over dripDuration',
                '4. Released yield increases USDs credits via rebase',
              ],
            },
            governance: {
              dripDurationRange: '1-14 days (governance controlled)',
              canPause: true,
              pauseAuthority: 'Sperax Multisig',
            },
            contracts: {
              dripper: CONTRACTS.DRIPPER,
              vault: CONTRACTS.VAULT,
              rebaseManager: CONTRACTS.REBASE_MANAGER,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get dripper config: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'dripper_estimate_next_rebase',
    description:
      'Estimate the next rebase amount and when it will occur. Helps users understand upcoming yield distribution.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const results = await multicall([
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'dripRate',
          },
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'availableFunds',
          },
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'lastCollectTimestamp',
          },
          {
            address: CONTRACTS.USDS,
            abi: ERC20ABI,
            functionName: 'totalSupply',
          },
        ]) as [bigint, bigint, bigint, bigint];

        const [dripRate, availableFunds, lastCollect, usdsSupply] = results;

        const dripRatePerSecond = Number(formatUnits(dripRate, 18));
        const usdsSupplyNum = Number(formatUnits(usdsSupply, 18));

        // Rebases typically happen every ~24 hours
        const rebaseInterval = 86400; // 24 hours in seconds
        const lastRebaseTime = Number(lastCollect);
        const nextRebaseTime = lastRebaseTime + rebaseInterval;
        const secondsUntilRebase = nextRebaseTime - Math.floor(Date.now() / 1000);

        // Estimate rebase amount (drip rate * interval)
        const estimatedRebaseAmount = dripRatePerSecond * rebaseInterval;
        const rebasePercentage = usdsSupplyNum > 0
          ? (estimatedRebaseAmount / usdsSupplyNum) * 100
          : 0;

        return {
          success: true,
          data: {
            nextRebase: {
              estimatedTime: new Date(nextRebaseTime * 1000).toISOString(),
              secondsUntil: Math.max(0, secondsUntilRebase),
              formatted: secondsUntilRebase > 0
                ? secondsUntilRebase > 3600
                  ? `in ${Math.floor(secondsUntilRebase / 3600)} hours`
                  : `in ${Math.floor(secondsUntilRebase / 60)} minutes`
                : 'Imminent (any moment)',
            },
            estimatedAmount: {
              usds: estimatedRebaseAmount.toFixed(2),
              percentage: `+${rebasePercentage.toFixed(6)}%`,
            },
            currentState: {
              dripRate: `${dripRatePerSecond.toFixed(6)} USDs/second`,
              availableFunds: `${formatUnits(availableFunds, 18)} USDs`,
              usdsSupply: `${usdsSupplyNum.toFixed(2)} USDs`,
            },
            annualized: {
              estimatedAPY: formatPercentage((rebasePercentage * 365) / 100),
              dailyRate: formatPercentage(rebasePercentage / 100),
            },
            note: 'Rebase amounts vary based on yield generated by strategies. This is an estimate based on current drip rate.',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to estimate next rebase: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'dripper_calculate_earnings',
    description:
      'Calculate expected earnings from USDs rebasing over a specified period. Shows projected yield for a given balance.',
    inputSchema: EstimateRebaseInput,
    handler: async (input: z.infer<typeof EstimateRebaseInput>) => {
      try {
        const balance = parseFloat(input.usdsBalance);
        if (isNaN(balance) || balance <= 0) {
          return {
            success: false,
            error: 'Invalid USDs balance',
          };
        }

        const [dripRate, usdsSupply] = await multicall([
          {
            address: CONTRACTS.DRIPPER,
            abi: DripperABI,
            functionName: 'dripRate',
          },
          {
            address: CONTRACTS.USDS,
            abi: ERC20ABI,
            functionName: 'totalSupply',
          },
        ]) as [bigint, bigint];

        const dripRatePerSecond = Number(formatUnits(dripRate, 18));
        const dripRatePerDay = dripRatePerSecond * 86400;
        const dripRatePerYear = dripRatePerDay * 365;
        const usdsSupplyNum = Number(formatUnits(usdsSupply, 18));

        // Calculate user's share of yield
        const userShare = balance / usdsSupplyNum;
        const dailyEarnings = dripRatePerDay * userShare;
        const projectedEarnings = dailyEarnings * input.days;
        const yearlyEarnings = dripRatePerYear * userShare;
        const apy = (yearlyEarnings / balance) * 100;

        return {
          success: true,
          data: {
            input: {
              balance: `${balance.toFixed(2)} USDs`,
              projectionDays: input.days,
            },
            share: {
              percentage: formatPercentage(userShare),
              ofTotalSupply: `${usdsSupplyNum.toFixed(2)} USDs`,
            },
            earnings: {
              daily: `${dailyEarnings.toFixed(4)} USDs`,
              weekly: `${(dailyEarnings * 7).toFixed(4)} USDs`,
              monthly: `${(dailyEarnings * 30).toFixed(4)} USDs`,
              projected: `${projectedEarnings.toFixed(4)} USDs over ${input.days} days`,
              yearly: `${yearlyEarnings.toFixed(2)} USDs`,
            },
            rates: {
              dailyRate: formatPercentage(dailyEarnings / balance),
              apy: formatPercentage(apy / 100),
            },
            endBalance: {
              projected: `${(balance + projectedEarnings).toFixed(4)} USDs`,
              gain: `+${projectedEarnings.toFixed(4)} USDs`,
              gainPercentage: `+${((projectedEarnings / balance) * 100).toFixed(4)}%`,
            },
            disclaimer: 'Projections based on current drip rate. Actual earnings may vary based on yield generated by strategies.',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to calculate earnings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default dripperTools;
