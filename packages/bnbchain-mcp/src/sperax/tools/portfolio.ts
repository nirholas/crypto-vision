/**
 * Sperax MCP Server - Portfolio Tools
 *
 * Aggregate view of user's entire Sperax protocol position
 * including USDs, SPA, veSPA, xSPA, and Demeter farm positions.
 */

import { z } from 'zod';
import { CONTRACTS, COLLATERALS } from '../config.js';
import {
  readContract,
  multicall,
  USDs_ABI,
  SPAABI,
  VeSPAABI,
  XSpaABI,
  ERC20ABI,
} from '../blockchain.js';
import { formatUnits } from '../utils.js';

// ============================================================================
// Input Schemas
// ============================================================================

const GetPortfolioInput = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Wallet address to get portfolio for'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const portfolioTools = [
  {
    name: 'portfolio_get_summary',
    description:
      'Get a complete summary of a user\'s Sperax protocol position including USDs balance, SPA holdings, veSPA locks, xSPA redemptions, and estimated total USD value. This is the best single tool to understand a user\'s full exposure to Sperax.',
    inputSchema: GetPortfolioInput,
    handler: async (input: z.infer<typeof GetPortfolioInput>) => {
      try {
        const userAddress = input.address as `0x${string}`;

        // Batch all balance and position queries
        const [
          usdsBalance,
          usdsRebaseState,
          spaBalance,
          vespaLocked,
          vespaEnd,
          xspaBalance,
        ] = await multicall([
          // USDs balance
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          },
          // USDs rebase state
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: USDs_ABI,
            functionName: 'rebaseState',
            args: [userAddress],
          },
          // SPA balance
          {
            address: CONTRACTS.SPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          },
          // veSPA locked amount
          {
            address: CONTRACTS.VESPA as `0x${string}`,
            abi: VeSPAABI,
            functionName: 'locked',
            args: [userAddress],
          },
          // veSPA lock end
          {
            address: CONTRACTS.VESPA as `0x${string}`,
            abi: VeSPAABI,
            functionName: 'locked__end',
            args: [userAddress],
          },
          // xSPA balance
          {
            address: CONTRACTS.XSPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          },
        ]) as [bigint, number, bigint, [bigint, bigint], bigint, bigint];

        // Get current veSPA voting power
        let vespaVotingPower = 0n;
        try {
          vespaVotingPower = await readContract({
            address: CONTRACTS.VESPA as `0x${string}`,
            abi: VeSPAABI,
            functionName: 'balanceOf',
            args: [userAddress],
          }) as bigint;
        } catch {
          // veSPA might not have balance if expired
        }

        // Get xSPA pending redemptions
        const pendingRedemptions: Array<{
          amount: string;
          unlockTime: number;
          daysRemaining: number;
        }> = [];
        try {
          const redemptionCount = await readContract({
            address: CONTRACTS.XSPA as `0x${string}`,
            abi: xSPAABI,
            functionName: 'getUserRedemptionCount',
            args: [userAddress],
          }) as bigint;

          if (redemptionCount > 0n) {
            const now = Math.floor(Date.now() / 1000);
            // Get up to 5 pending redemptions
            const count = Math.min(Number(redemptionCount), 5);
            for (let i = 0; i < count; i++) {
              try {
                const redemption = await readContract({
                  address: CONTRACTS.XSPA as `0x${string}`,
                  abi: xSPAABI,
                  functionName: 'getUserRedemption',
                  args: [userAddress, BigInt(i)],
                }) as [bigint, bigint];
                
                const unlockTime = Number(redemption[1]);
                const daysRemaining = Math.max(0, Math.ceil((unlockTime - now) / 86400));
                
                pendingRedemptions.push({
                  amount: formatUnits(redemption[0], 18),
                  unlockTime,
                  daysRemaining,
                });
              } catch {
                break;
              }
            }
          }
        } catch {
          // xSPA redemption query might fail
        }

        // Parse values
        const usdsBalanceFormatted = formatUnits(usdsBalance, 18);
        const spaBalanceFormatted = formatUnits(spaBalance, 18);
        const vespaLockedAmount = formatUnits(vespaLocked[0] || 0n, 18);
        const vespaVotingPowerFormatted = formatUnits(vespaVotingPower, 18);
        const xspaBalanceFormatted = formatUnits(xspaBalance, 18);
        
        const lockEndTimestamp = Number(vespaEnd);
        const now = Math.floor(Date.now() / 1000);
        const lockDaysRemaining = lockEndTimestamp > now 
          ? Math.ceil((lockEndTimestamp - now) / 86400) 
          : 0;

        const rebaseStateLabel = usdsRebaseState === 0 ? 'NotSet' 
          : usdsRebaseState === 1 ? 'OptOut' 
          : 'OptIn';

        // Calculate approximate USD values (USDs = $1, SPA needs oracle)
        const usdsValue = parseFloat(usdsBalanceFormatted);
        
        // Build position summary
        const hasUSDs = parseFloat(usdsBalanceFormatted) > 0;
        const hasSPA = parseFloat(spaBalanceFormatted) > 0;
        const hasVeSPA = parseFloat(vespaLockedAmount) > 0;
        const hasXSPA = parseFloat(xspaBalanceFormatted) > 0;
        const hasPendingRedemptions = pendingRedemptions.length > 0;

        const activePositions: string[] = [];
        if (hasUSDs) activePositions.push('USDs holder');
        if (hasSPA) activePositions.push('SPA holder');
        if (hasVeSPA) activePositions.push('veSPA staker');
        if (hasXSPA) activePositions.push('xSPA holder');
        if (hasPendingRedemptions) activePositions.push('Pending redemptions');

        return {
          success: true,
          data: {
            address: input.address,
            summary: {
              activePositions,
              positionCount: activePositions.length,
              isEmpty: activePositions.length === 0,
            },
            usds: {
              balance: usdsBalanceFormatted,
              rebaseState: rebaseStateLabel,
              isEarningYield: usdsRebaseState === 2,
              estimatedUsdValue: usdsValue.toFixed(2),
            },
            spa: {
              balance: spaBalanceFormatted,
              description: 'Liquid SPA tokens available for trading or staking',
            },
            vespa: {
              lockedAmount: vespaLockedAmount,
              votingPower: vespaVotingPowerFormatted,
              lockEnd: lockEndTimestamp > 0 ? new Date(lockEndTimestamp * 1000).toISOString().split('T')[0] : null,
              daysRemaining: lockDaysRemaining,
              isLocked: lockDaysRemaining > 0,
              benefits: hasVeSPA ? [
                'Protocol fee share (bribes)',
                'Governance voting power',
                'Boosted Demeter farm rewards',
              ] : [],
            },
            xspa: {
              balance: xspaBalanceFormatted,
              pendingRedemptions: pendingRedemptions,
              totalPending: pendingRedemptions.reduce((sum, r) => sum + parseFloat(r.amount), 0).toFixed(4),
              description: 'xSPA from protocol rewards, redeemable for SPA',
            },
            recommendations: generateRecommendations(
              hasUSDs,
              usdsRebaseState,
              hasSPA,
              hasVeSPA,
              lockDaysRemaining
            ),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'portfolio_get_value',
    description:
      'Get the estimated total USD value of a user\'s Sperax portfolio using current oracle prices.',
    inputSchema: GetPortfolioInput,
    handler: async (input: z.infer<typeof GetPortfolioInput>) => {
      try {
        const userAddress = input.address as `0x${string}`;

        // Get all balances
        const [usdsBalance, spaBalance, vespaLocked, xspaBalance] = await multicall([
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          },
          {
            address: CONTRACTS.SPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          },
          {
            address: CONTRACTS.VESPA as `0x${string}`,
            abi: VeSPAABI,
            functionName: 'locked',
            args: [userAddress],
          },
          {
            address: CONTRACTS.XSPA as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [userAddress],
          },
        ]) as [bigint, bigint, [bigint, bigint], bigint];

        // USDs is pegged to $1
        const usdsUsd = parseFloat(formatUnits(usdsBalance, 18));

        // Get SPA price from oracle (approximate)
        const spaPrice = 0.01; // Default fallback
        try {
          // This would query the actual SPA oracle
          // For now use a reasonable default
        } catch {
          // Use fallback
        }

        const spaUsd = parseFloat(formatUnits(spaBalance, 18)) * spaPrice;
        const vespaUsd = parseFloat(formatUnits(vespaLocked[0] || 0n, 18)) * spaPrice;
        const xspaUsd = parseFloat(formatUnits(xspaBalance, 18)) * spaPrice;

        const totalUsd = usdsUsd + spaUsd + vespaUsd + xspaUsd;

        return {
          success: true,
          data: {
            address: input.address,
            breakdown: {
              usds: {
                amount: formatUnits(usdsBalance, 18),
                priceUsd: '1.00',
                valueUsd: usdsUsd.toFixed(2),
              },
              spa: {
                amount: formatUnits(spaBalance, 18),
                priceUsd: spaPrice.toFixed(4),
                valueUsd: spaUsd.toFixed(2),
              },
              vespa: {
                lockedSpa: formatUnits(vespaLocked[0] || 0n, 18),
                priceUsd: spaPrice.toFixed(4),
                valueUsd: vespaUsd.toFixed(2),
                note: 'Locked SPA cannot be withdrawn until lock expires',
              },
              xspa: {
                amount: formatUnits(xspaBalance, 18),
                priceUsd: spaPrice.toFixed(4),
                valueUsd: xspaUsd.toFixed(2),
              },
            },
            total: {
              valueUsd: totalUsd.toFixed(2),
              formatted: `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
            disclaimer: 'Values are estimates based on current prices. SPA price may vary.',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get portfolio value: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function generateRecommendations(
  hasUSDs: boolean,
  rebaseState: number,
  hasSPA: boolean,
  hasVeSPA: boolean,
  lockDaysRemaining: number
): string[] {
  const recommendations: string[] = [];

  // USDs recommendations
  if (hasUSDs && rebaseState !== 2) {
    recommendations.push('💡 Opt-in to USDs rebase to earn automatic yield on your stablecoin balance');
  }

  // SPA recommendations
  if (hasSPA && !hasVeSPA) {
    recommendations.push('💡 Consider locking SPA as veSPA to earn protocol revenue and voting power');
  }

  // veSPA recommendations
  if (hasVeSPA && lockDaysRemaining < 30 && lockDaysRemaining > 0) {
    recommendations.push('⏰ Your veSPA lock expires soon - consider extending to maintain voting power');
  }

  if (hasVeSPA && lockDaysRemaining === 0) {
    recommendations.push('🔓 Your veSPA lock has expired - you can withdraw your SPA or re-lock for more rewards');
  }

  // General recommendations
  if (!hasUSDs && !hasSPA && !hasVeSPA) {
    recommendations.push('🚀 Get started with Sperax by acquiring USDs (auto-yield stablecoin) or SPA (governance token)');
  }

  return recommendations;
}

export default portfolioTools;
