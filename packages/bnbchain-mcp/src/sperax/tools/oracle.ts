/**
 * Sperax MCP Server - Oracle Tools
 *
 * Tools for interacting with Sperax oracle system including
 * price feeds, staleness checks, and deviation monitoring.
 */

import { z } from 'zod';
import { CONTRACTS, COLLATERALS } from '../config.js';
import { multicall, OracleABI } from '../blockchain.js';
import { formatUnits } from '../utils.js';

// ============================================================================
// Input Schemas
// ============================================================================

const GetPriceInput = z.object({
  asset: z
    .enum(['USDC', 'USDT', 'DAI', 'FRAX', 'SPA', 'ETH'])
    .describe('Asset to get price for'),
});

const CheckDeviationInput = z.object({
  asset: z
    .enum(['USDC', 'USDT', 'DAI', 'FRAX'])
    .describe('Collateral asset to check'),
  threshold: z
    .number()
    .min(0.01)
    .max(10)
    .optional()
    .default(1)
    .describe('Deviation threshold in percentage (default: 1%)'),
});

// ============================================================================
// Constants
// ============================================================================

// Additional oracles for non-collateral assets
const ADDITIONAL_ORACLES: Record<string, { oracle: `0x${string}`; decimals: number }> = {
  SPA: {
    oracle: '0x0000000000000000000000000000000000000000' as `0x${string}`, // Would be actual address
    decimals: 8,
  },
  ETH: {
    oracle: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612' as `0x${string}`, // Chainlink ETH/USD on Arbitrum
    decimals: 8,
  },
};

// ============================================================================
// Tool Definitions
// ============================================================================

export const oracleTools = [
  {
    name: 'oracle_get_all_prices',
    description:
      'Get current prices for all collateral assets from Chainlink oracles. Shows price, last update time, and freshness status.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const collateralList = Object.entries(COLLATERALS);

        const calls = collateralList.map(([, config]) => ({
          address: config.oracle as `0x${string}`,
          abi: OracleABI,
          functionName: 'latestRoundData',
        }));

        const results = await multicall(calls);

        const prices = collateralList.map(([symbol, config], index) => {
          const roundData = results[index] as [bigint, bigint, bigint, bigint, bigint];
          const [roundId, answer, startedAt, updatedAt, answeredInRound] = roundData;

          const priceFormatted = formatUnits(answer, 8);
          const ageSeconds = Math.floor(Date.now() / 1000) - Number(updatedAt);

          return {
            symbol,
            price: {
              raw: answer.toString(),
              formatted: `$${Number(priceFormatted).toFixed(4)}`,
              decimals: 8,
            },
            oracle: {
              address: config.oracle,
              provider: 'Chainlink',
              roundId: roundId.toString(),
            },
            timing: {
              updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
              startedAt: new Date(Number(startedAt) * 1000).toISOString(),
              ageSeconds,
              ageFriendly:
                ageSeconds < 60
                  ? `${ageSeconds}s`
                  : ageSeconds < 3600
                    ? `${Math.floor(ageSeconds / 60)}m`
                    : `${Math.floor(ageSeconds / 3600)}h`,
            },
            status: {
              isFresh: ageSeconds < 300,
              isStale: ageSeconds > 3600,
              isValid: answeredInRound >= roundId,
              health: ageSeconds < 300 ? 'FRESH' : ageSeconds < 3600 ? 'OK' : 'STALE',
            },
          };
        });

        // Calculate aggregate stats
        const allFresh = prices.every((p) => p.status.isFresh);
        const anyStale = prices.some((p) => p.status.isStale);
        const avgAge =
          prices.reduce((sum, p) => sum + p.timing.ageSeconds, 0) / prices.length;

        return {
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            summary: {
              totalOracles: prices.length,
              overallHealth: anyStale ? 'DEGRADED' : allFresh ? 'OPTIMAL' : 'NORMAL',
              averageAge: `${Math.round(avgAge)}s`,
              freshCount: prices.filter((p) => p.status.isFresh).length,
              staleCount: prices.filter((p) => p.status.isStale).length,
            },
            prices,
            thresholds: {
              fresh: '< 5 minutes',
              normal: '5 min - 1 hour',
              stale: '> 1 hour',
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get oracle prices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'oracle_get_price',
    description:
      'Get the current price for a specific asset from its Chainlink oracle. Includes detailed round data and freshness info.',
    inputSchema: GetPriceInput,
    handler: async (input: z.infer<typeof GetPriceInput>) => {
      try {
        let oracleAddress: `0x${string}`;
        let decimals = 8;

        if (input.asset in COLLATERALS) {
          const config = COLLATERALS[input.asset as keyof typeof COLLATERALS];
          oracleAddress = config.oracle as `0x${string}`;
        } else if (input.asset in ADDITIONAL_ORACLES) {
          const config = ADDITIONAL_ORACLES[input.asset];
          oracleAddress = config.oracle;
          decimals = config.decimals;
        } else {
          return {
            success: false,
            error: `Unknown asset: ${input.asset}`,
          };
        }

        const [roundData, oracleDecimals] = await multicall([
          {
            address: oracleAddress,
            abi: OracleABI,
            functionName: 'latestRoundData',
          },
          {
            address: oracleAddress,
            abi: OracleABI,
            functionName: 'decimals',
          },
        ]);

        const [roundId, answer, startedAt, updatedAt, answeredInRound] =
          roundData as [bigint, bigint, bigint, bigint, bigint];

        const actualDecimals = oracleDecimals ? Number(oracleDecimals) : decimals;
        const priceFormatted = formatUnits(answer, actualDecimals);
        const ageSeconds = Math.floor(Date.now() / 1000) - Number(updatedAt);

        return {
          success: true,
          data: {
            asset: input.asset,
            price: {
              raw: answer.toString(),
              formatted: `$${Number(priceFormatted).toFixed(6)}`,
              decimals: actualDecimals,
            },
            oracle: {
              address: oracleAddress,
              provider: 'Chainlink',
              description: `${input.asset}/USD Price Feed`,
            },
            roundData: {
              roundId: roundId.toString(),
              answeredInRound: answeredInRound.toString(),
              startedAt: new Date(Number(startedAt) * 1000).toISOString(),
              updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
            },
            freshness: {
              ageSeconds,
              ageFriendly:
                ageSeconds < 60
                  ? `${ageSeconds} seconds ago`
                  : ageSeconds < 3600
                    ? `${Math.floor(ageSeconds / 60)} minutes ago`
                    : `${Math.floor(ageSeconds / 3600)} hours ago`,
              isFresh: ageSeconds < 300,
              isStale: ageSeconds > 3600,
            },
            validation: {
              isValid: answeredInRound >= roundId,
              isPositive: answer > 0n,
              isReasonable: Number(priceFormatted) > 0.01 && Number(priceFormatted) < 100000,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get price for ${input.asset}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'oracle_check_staleness',
    description:
      'Check if any oracle prices are stale (outdated). Critical for protocol safety monitoring.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const collateralList = Object.entries(COLLATERALS);

        const calls = collateralList.map(([, config]) => ({
          address: config.oracle as `0x${string}`,
          abi: OracleABI,
          functionName: 'latestRoundData',
        }));

        const results = await multicall(calls);

        const checks = collateralList.map(([symbol, config], index) => {
          const roundData = results[index] as [bigint, bigint, bigint, bigint, bigint];
          const [roundId, answer, , updatedAt, answeredInRound] = roundData;

          const ageSeconds = Math.floor(Date.now() / 1000) - Number(updatedAt);

          // Define thresholds
          const warningThreshold = 1800; // 30 minutes
          const criticalThreshold = 3600; // 1 hour
          const maxThreshold = 86400; // 24 hours

          let status: 'FRESH' | 'WARNING' | 'STALE' | 'CRITICAL';
          if (ageSeconds < warningThreshold) {
            status = 'FRESH';
          } else if (ageSeconds < criticalThreshold) {
            status = 'WARNING';
          } else if (ageSeconds < maxThreshold) {
            status = 'STALE';
          } else {
            status = 'CRITICAL';
          }

          return {
            symbol,
            oracle: config.oracle,
            price: `$${formatUnits(answer, 8)}`,
            lastUpdate: new Date(Number(updatedAt) * 1000).toISOString(),
            ageSeconds,
            status,
            isValid: answeredInRound >= roundId && answer > 0n,
            action:
              status === 'CRITICAL'
                ? 'URGENT: Oracle appears dead, protocol may need pause'
                : status === 'STALE'
                  ? 'Monitor closely, may need intervention'
                  : status === 'WARNING'
                    ? 'Slightly delayed, monitoring recommended'
                    : 'No action needed',
          };
        });

        const criticalCount = checks.filter((c) => c.status === 'CRITICAL').length;
        const staleCount = checks.filter((c) => c.status === 'STALE').length;
        const warningCount = checks.filter((c) => c.status === 'WARNING').length;

        return {
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            summary: {
              totalOracles: checks.length,
              fresh: checks.length - criticalCount - staleCount - warningCount,
              warning: warningCount,
              stale: staleCount,
              critical: criticalCount,
              overallStatus:
                criticalCount > 0
                  ? 'CRITICAL'
                  : staleCount > 0
                    ? 'DEGRADED'
                    : warningCount > 0
                      ? 'WARNING'
                      : 'HEALTHY',
            },
            checks,
            thresholds: {
              fresh: '< 30 minutes',
              warning: '30 min - 1 hour',
              stale: '1 hour - 24 hours',
              critical: '> 24 hours',
            },
            recommendations:
              criticalCount > 0
                ? [
                    'URGENT: Consider pausing minting/redemption',
                    'Contact oracle providers',
                    'Check network status',
                  ]
                : staleCount > 0
                  ? [
                      'Monitor situation closely',
                      'Prepare contingency plans',
                      'Check oracle provider status',
                    ]
                  : ['All oracles healthy', 'No action required'],
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to check oracle staleness: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'oracle_check_deviation',
    description:
      'Check if a stablecoin price has deviated from $1.00 beyond a threshold. Important for monitoring depeg risks.',
    inputSchema: CheckDeviationInput,
    handler: async (input: z.infer<typeof CheckDeviationInput>) => {
      try {
        const config = COLLATERALS[input.asset];
        if (!config) {
          return {
            success: false,
            error: `Unknown collateral: ${input.asset}`,
          };
        }

        const roundData = await multicall([
          {
            address: config.oracle as `0x${string}`,
            abi: OracleABI,
            functionName: 'latestRoundData',
          },
        ]);

        const [, answer, , updatedAt] = roundData[0] as [bigint, bigint, bigint, bigint, bigint];

        const price = Number(formatUnits(answer, 8));
        const targetPrice = 1.0;
        const deviation = ((price - targetPrice) / targetPrice) * 100;
        const absoluteDeviation = Math.abs(deviation);
        const isDeviating = absoluteDeviation > input.threshold;

        return {
          success: true,
          data: {
            asset: input.asset,
            currentPrice: `$${price.toFixed(6)}`,
            targetPrice: '$1.00',
            deviation: {
              percentage: `${deviation > 0 ? '+' : ''}${deviation.toFixed(4)}%`,
              absolute: `${absoluteDeviation.toFixed(4)}%`,
              basisPoints: Math.round(absoluteDeviation * 100),
              direction: deviation > 0 ? 'above' : deviation < 0 ? 'below' : 'at',
            },
            threshold: {
              value: `${input.threshold}%`,
              exceeded: isDeviating,
            },
            lastUpdate: new Date(Number(updatedAt) * 1000).toISOString(),
            status: {
              isPegged: absoluteDeviation < 0.1,
              isHealthy: absoluteDeviation < 0.5,
              isWarning: absoluteDeviation >= 0.5 && absoluteDeviation < 2,
              isCritical: absoluteDeviation >= 2,
            },
            impact: isDeviating
              ? {
                  minting:
                    deviation > 0
                      ? 'Users get slightly less USDs per collateral'
                      : 'Users get slightly more USDs per collateral',
                  redemption:
                    deviation > 0
                      ? 'Users get slightly more collateral per USDs'
                      : 'Users get slightly less collateral per USDs',
                  arbitrage:
                    deviation > input.threshold
                      ? `Arbitrage opportunity: ${deviation > 0 ? 'sell' : 'buy'} ${input.asset}`
                      : 'No significant arbitrage opportunity',
                }
              : { message: 'Price within acceptable range, no impact' },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to check deviation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'oracle_get_sources',
    description:
      'Get information about oracle sources and providers used by Sperax. Shows oracle architecture and redundancy.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const oracleInfo = Object.entries(COLLATERALS).map(([symbol, config]) => ({
          asset: symbol,
          oracle: config.oracle,
          provider: 'Chainlink',
          pair: `${symbol}/USD`,
          decimals: 8,
          network: 'Arbitrum One',
        }));

        return {
          success: true,
          data: {
            primaryProvider: {
              name: 'Chainlink',
              type: 'Decentralized Oracle Network',
              security: 'Multiple independent node operators',
              url: 'https://chain.link',
            },
            oracles: oracleInfo,
            architecture: {
              type: 'Direct Chainlink Integration',
              description:
                'Sperax uses Chainlink price feeds directly for collateral valuation',
              features: [
                'Decentralized price aggregation',
                'Multiple data sources per asset',
                'Deviation threshold triggers',
                'Heartbeat updates',
              ],
            },
            redundancy: {
              hasBackup: false,
              backupProvider: null,
              fallbackMechanism: 'Protocol pauses if oracles fail',
            },
            updateFrequency: {
              deviation: '0.1% price change triggers update',
              heartbeat: 'Guaranteed update every 1 hour',
              typical: 'Updates every few minutes under normal conditions',
            },
            security: {
              audited: true,
              timelock: 'Oracle addresses protected by governance timelock',
              monitoring: '24/7 oracle health monitoring',
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get oracle sources: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default oracleTools;
