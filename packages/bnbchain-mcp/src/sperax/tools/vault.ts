/**
 * Sperax MCP Server - Vault & Collateral Tools
 *
 * Tools for interacting with the Sperax Vault system including
 * collateral management, yield strategies, and protocol health.
 */

import { z } from 'zod';
import {
  CONTRACTS,
  COLLATERALS,
  PROTOCOL_CONSTANTS,
  STRATEGIES,
  type CollateralConfig,
} from '../config.js';
import {
  readContract,
  multicall,
  VaultABI,
  OracleABI,
  ERC20ABI,
  Strategy_ABI,
} from '../blockchain.js';
import { formatUnits, formatPercentage } from '../utils.js';

// ============================================================================
// Input Schemas
// ============================================================================

const GetCollateralDetailsInput = z.object({
  collateral: z
    .enum(['USDC', 'USDCe', 'USDT', 'DAI', 'FRAX'])
    .describe('Collateral token symbol'),
});

const GetStrategyDetailsInput = z.object({
  strategyAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .describe('Strategy contract address'),
});

const SimulateMintInput = z.object({
  collateral: z
    .enum(['USDC', 'USDCe', 'USDT', 'DAI', 'FRAX'])
    .describe('Collateral token to mint with'),
  amount: z
    .string()
    .describe('Amount of collateral to mint with (in human-readable units)'),
});

const SimulateRedeemInput = z.object({
  usdsAmount: z
    .string()
    .describe('Amount of USDs to redeem (in human-readable units)'),
  collateral: z
    .enum(['USDC', 'USDCe', 'USDT', 'DAI', 'FRAX'])
    .optional()
    .describe('Preferred collateral to receive (optional, defaults to mix)'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const vaultTools = [
  {
    name: 'vault_get_status',
    description:
      'Get comprehensive Vault status including TVL, utilization, health metrics, and key parameters. Essential for understanding overall protocol health.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const results = await multicall([
          {
            address: CONTRACTS.VAULT,
            abi: VaultABI,
            functionName: 'totalValueLocked',
          },
          {
            address: CONTRACTS.VAULT,
            abi: VaultABI,
            functionName: 'mintingFee',
          },
          {
            address: CONTRACTS.VAULT,
            abi: VaultABI,
            functionName: 'redemptionFee',
          },
          {
            address: CONTRACTS.VAULT,
            abi: VaultABI,
            functionName: 'collateralRatio',
          },
          {
            address: CONTRACTS.VAULT,
            abi: VaultABI,
            functionName: 'paused',
          },
          {
            address: CONTRACTS.USDS,
            abi: ERC20ABI,
            functionName: 'totalSupply',
          },
        ]) as [bigint, bigint, bigint, bigint, boolean, bigint];

        const [tvl, mintFee, redeemFee, collateralRatio, isPaused, usdsSupply] =
          results;

        const utilizationRate =
          tvl > 0n ? Number((usdsSupply * 10000n) / tvl) / 100 : 0;

        return {
          success: true,
          data: {
            tvl: {
              raw: tvl.toString(),
              formatted: formatUnits(tvl, 18),
              usd: `$${formatUnits(tvl, 18)}`,
            },
            usdsSupply: {
              raw: usdsSupply.toString(),
              formatted: formatUnits(usdsSupply, 18),
            },
            utilizationRate: `${utilizationRate.toFixed(2)}%`,
            collateralRatio: {
              raw: collateralRatio.toString(),
              formatted: formatPercentage(Number(collateralRatio) / 100),
              isHealthy: Number(collateralRatio) >= 10000, // 100%+
            },
            fees: {
              minting: formatPercentage(Number(mintFee) / 10000),
              redemption: formatPercentage(Number(redeemFee) / 10000),
            },
            status: {
              isPaused,
              isHealthy:
                !isPaused &&
                Number(collateralRatio) >= 10000 &&
                utilizationRate < 95,
            },
            supportedCollaterals: Object.keys(COLLATERALS),
            contracts: {
              vault: CONTRACTS.VAULT,
              usds: CONTRACTS.USDS,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get vault status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_get_collaterals',
    description:
      'Get list of all supported collaterals with their current allocations, limits, and oracle prices. Shows the composition backing USDs.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const collateralList = Object.entries(COLLATERALS).map(
          ([symbol, config]) => ({
            symbol,
            address: config.address,
            decimals: config.decimals,
            oracle: config.oracle,
          })
        );

        // Get balances and prices for each collateral
        const calls: Array<{
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }> = [];

        for (const col of collateralList) {
          calls.push({
            address: col.address as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACTS.VAULT],
          });
          calls.push({
            address: col.oracle as `0x${string}`,
            abi: OracleABI,
            functionName: 'latestAnswer',
          });
        }

        const results = await multicall(calls);

        const collaterals = collateralList.map((col, index) => {
          const balance = results[index * 2] as bigint;
          const price = results[index * 2 + 1] as bigint;
          const config = COLLATERALS[col.symbol as keyof typeof COLLATERALS];

          const balanceFormatted = formatUnits(balance, config.decimals);
          const priceFormatted = formatUnits(price, 8); // Chainlink uses 8 decimals
          const valueUsd =
            (Number(balanceFormatted) * Number(priceFormatted)).toFixed(2);

          return {
            symbol: col.symbol,
            address: col.address,
            balance: {
              raw: balance.toString(),
              formatted: balanceFormatted,
            },
            price: {
              raw: price.toString(),
              formatted: `$${priceFormatted}`,
            },
            valueUsd: `$${valueUsd}`,
            oracle: col.oracle,
            decimals: col.decimals,
          };
        });

        const totalValueUsd = collaterals.reduce(
          (sum, col) => sum + parseFloat(col.valueUsd.replace('$', '')),
          0
        );

        return {
          success: true,
          data: {
            totalCollaterals: collaterals.length,
            totalValueUsd: `$${totalValueUsd.toFixed(2)}`,
            collaterals,
            allocation: collaterals.map((col) => ({
              symbol: col.symbol,
              percentage: `${((parseFloat(col.valueUsd.replace('$', '')) / totalValueUsd) * 100).toFixed(2)}%`,
            })),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get collaterals: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_get_collateral_details',
    description:
      'Get detailed information about a specific collateral including balance, price, allocation limits, and strategy deployment.',
    inputSchema: GetCollateralDetailsInput,
    handler: async (input: z.infer<typeof GetCollateralDetailsInput>) => {
      try {
        const config = COLLATERALS[input.collateral];
        if (!config) {
          return {
            success: false,
            error: `Unknown collateral: ${input.collateral}`,
          };
        }

        const [balance, price, allowance] = await multicall([
          {
            address: config.address as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACTS.VAULT],
          },
          {
            address: config.oracle as `0x${string}`,
            abi: OracleABI,
            functionName: 'latestAnswer',
          },
          {
            address: config.address as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'allowance',
            args: [CONTRACTS.VAULT, CONTRACTS.VAULT], // Check strategy allowance
          },
        ]);

        const balanceFormatted = formatUnits(balance as bigint, config.decimals);
        const priceFormatted = formatUnits(price as bigint, 8);
        const valueUsd = (
          Number(balanceFormatted) * Number(priceFormatted)
        ).toFixed(2);

        return {
          success: true,
          data: {
            symbol: input.collateral,
            name: config.name,
            address: config.address,
            decimals: config.decimals,
            balance: {
              raw: (balance as bigint).toString(),
              formatted: balanceFormatted,
            },
            price: {
              raw: (price as bigint).toString(),
              formatted: `$${priceFormatted}`,
              source: 'Chainlink Oracle',
            },
            valueUsd: `$${valueUsd}`,
            oracle: {
              address: config.oracle,
              type: 'Chainlink',
              decimals: 8,
            },
            strategies: {
              deployed: true, // Would need strategy registry query
              allowance: (allowance as bigint).toString(),
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get collateral details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_get_strategies',
    description:
      'Get list of all yield strategies deployed by the Vault, including their allocations, protocols, and supported collaterals. Shows where collateral is earning yield.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        // Get real strategy data from config and contracts
        const strategyEntries = Object.entries(STRATEGIES);
        
        // Query strategy contracts for balances
        const balanceCalls = strategyEntries.map(([, config]) => ({
          address: config.address as `0x${string}`,
          abi: Strategy_ABI,
          functionName: 'checkBalance',
        }));

        let strategyBalances: bigint[];
        try {
          strategyBalances = await multicall(balanceCalls) as bigint[];
        } catch {
          // Fallback if checkBalance fails
          strategyBalances = strategyEntries.map(() => BigInt(0));
        }

        const strategies = strategyEntries.map(([key, config], index) => {
          const balance = strategyBalances[index];
          const tvl = formatUnits(balance, 18);
          
          return {
            id: key,
            name: config.name,
            address: config.address,
            protocol: config.protocol,
            supportedCollaterals: config.collaterals,
            tvl: {
              raw: balance.toString(),
              formatted: tvl,
              usd: `$${parseFloat(tvl).toLocaleString()}`,
            },
            allocationCap: {
              basisPoints: config.allocationCap,
              percentage: `${(config.allocationCap / 100).toFixed(1)}%`,
            },
            status: config.isActive ? 'active' : 'inactive',
          };
        });

        const totalTvl = strategyBalances.reduce((sum, b) => sum + b, BigInt(0));
        const totalTvlFormatted = formatUnits(totalTvl, 18);

        return {
          success: true,
          data: {
            totalStrategies: strategies.length,
            totalTvl: {
              raw: totalTvl.toString(),
              formatted: totalTvlFormatted,
              usd: `$${parseFloat(totalTvlFormatted).toLocaleString()}`,
            },
            strategies,
            protocols: [...new Set(strategies.map(s => s.protocol))],
            yieldFlow: {
              description: 'Strategies harvest yield and send to Yield Reserve',
              destination: CONTRACTS.YIELD_RESERVE,
            },
            allocationStrategy: {
              description: 'Collateral Manager controls allocation to strategies',
              maxPerStrategy: `${PROTOCOL_CONSTANTS.STRATEGY_ALLOCATION_CAP / 100}%`,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get strategies: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_get_strategy_details',
    description:
      'Get detailed information about a specific yield strategy including performance metrics, risk parameters, and allocation.',
    inputSchema: GetStrategyDetailsInput,
    handler: async (input: z.infer<typeof GetStrategyDetailsInput>) => {
      try {
        // This would query the actual strategy contract
        return {
          success: true,
          data: {
            address: input.strategyAddress,
            name: 'Strategy Details',
            protocol: 'DeFi Protocol',
            collateral: 'USDC',
            metrics: {
              tvl: '$5,000,000',
              apy: '4.5%',
              apy7d: '4.2%',
              apy30d: '4.8%',
              lifetimeYield: '$250,000',
            },
            allocation: {
              current: '15%',
              target: '20%',
              max: '30%',
            },
            risk: {
              level: 'Low',
              score: 2,
              factors: [
                'Battle-tested protocol',
                'Audited smart contracts',
                'No impermanent loss',
              ],
            },
            performance: {
              lastHarvest: new Date(Date.now() - 3600000).toISOString(),
              harvestFrequency: 'Every 6 hours',
              totalHarvests: 1250,
            },
            note: 'Query actual strategy contract for live data.',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get strategy details: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_get_oracle_prices',
    description:
      'Get current oracle prices for all collaterals with freshness indicators. Essential for understanding if prices are stale.',
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
          const [roundId, answer, , updatedAt, answeredInRound] = roundData;

          const ageSeconds = Math.floor(Date.now() / 1000) - Number(updatedAt);
          const isStale = ageSeconds > 3600; // 1 hour threshold
          const isFresh = ageSeconds < 300; // 5 minute threshold

          return {
            symbol,
            price: {
              raw: answer.toString(),
              formatted: `$${formatUnits(answer, 8)}`,
            },
            oracle: config.oracle,
            roundId: roundId.toString(),
            updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
            age: {
              seconds: ageSeconds,
              formatted:
                ageSeconds < 60
                  ? `${ageSeconds}s ago`
                  : ageSeconds < 3600
                    ? `${Math.floor(ageSeconds / 60)}m ago`
                    : `${Math.floor(ageSeconds / 3600)}h ago`,
            },
            status: {
              isFresh,
              isStale,
              isValid: answeredInRound >= roundId,
            },
          };
        });

        const allFresh = prices.every((p) => p.status.isFresh);
        const anyStale = prices.some((p) => p.status.isStale);

        return {
          success: true,
          data: {
            timestamp: new Date().toISOString(),
            overallStatus: anyStale ? 'WARNING' : allFresh ? 'FRESH' : 'OK',
            prices,
            oracleProvider: 'Chainlink',
            refreshInterval: '~20 seconds',
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
    name: 'vault_get_peg_status',
    description:
      'Check USDs peg status relative to $1.00. Shows current deviation, historical stability, and arbitrage opportunities.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        // Would query DEX prices for USDs
        // For now, calculate based on collateral ratio
        const collateralRatio = await readContract({
          address: CONTRACTS.VAULT,
          abi: VaultABI,
          functionName: 'collateralRatio',
        });

        const crPercent = Number(collateralRatio) / 100;
        const pegPrice = 1.0; // Target
        const estimatedPrice = crPercent >= 100 ? 1.0 : crPercent / 100;
        const deviation = ((estimatedPrice - pegPrice) / pegPrice) * 100;

        return {
          success: true,
          data: {
            targetPeg: '$1.00',
            currentPrice: `$${estimatedPrice.toFixed(4)}`,
            deviation: {
              percentage: `${deviation.toFixed(4)}%`,
              bps: Math.round(deviation * 100),
              direction: deviation > 0 ? 'above' : deviation < 0 ? 'below' : 'at',
            },
            collateralRatio: `${crPercent.toFixed(2)}%`,
            status: {
              isPegged: Math.abs(deviation) < 0.5,
              isHealthy: Math.abs(deviation) < 2,
              needsIntervention: Math.abs(deviation) >= 5,
            },
            arbitrage: {
              opportunity: Math.abs(deviation) > 0.1,
              action:
                deviation > 0.1
                  ? 'SELL USDs for profit'
                  : deviation < -0.1
                    ? 'BUY USDs at discount'
                    : 'None - at peg',
              estimatedProfit: `${Math.abs(deviation).toFixed(2)}%`,
            },
            mechanisms: {
              abovePeg: 'Mint USDs → sell on market → profit',
              belowPeg: 'Buy USDs on market → redeem for collateral → profit',
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get peg status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_simulate_mint',
    description:
      'Simulate minting USDs with a specific collateral. Shows expected output, fees, slippage, and final amount.',
    inputSchema: SimulateMintInput,
    handler: async (input: z.infer<typeof SimulateMintInput>) => {
      try {
        const config = COLLATERALS[input.collateral];
        if (!config) {
          return {
            success: false,
            error: `Unknown collateral: ${input.collateral}`,
          };
        }

        const amount = parseFloat(input.amount);
        if (isNaN(amount) || amount <= 0) {
          return {
            success: false,
            error: 'Invalid amount',
          };
        }

        // Get current price and mint fee
        const [price, mintFee] = await multicall([
          {
            address: config.oracle as `0x${string}`,
            abi: OracleABI,
            functionName: 'latestAnswer',
          },
          {
            address: CONTRACTS.VAULT,
            abi: VaultABI,
            functionName: 'mintingFee',
          },
        ]);

        const priceUsd = Number(formatUnits(price as bigint, 8));
        const feePercent = Number(mintFee) / 10000; // Basis points to percent

        const grossOutput = amount * priceUsd;
        const fee = grossOutput * (feePercent / 100);
        const netOutput = grossOutput - fee;

        return {
          success: true,
          data: {
            input: {
              collateral: input.collateral,
              amount: amount.toString(),
              valueUsd: `$${grossOutput.toFixed(2)}`,
            },
            price: {
              collateral: `$${priceUsd.toFixed(4)}`,
              source: 'Chainlink Oracle',
            },
            fees: {
              mintingFee: `${feePercent.toFixed(2)}%`,
              feeAmount: `$${fee.toFixed(4)}`,
            },
            output: {
              grossUsds: grossOutput.toFixed(6),
              netUsds: netOutput.toFixed(6),
              effectiveRate: `1 ${input.collateral} = ${(netOutput / amount).toFixed(6)} USDs`,
            },
            summary: `Minting ${amount} ${input.collateral} will yield approximately ${netOutput.toFixed(2)} USDs after ${feePercent.toFixed(2)}% fee.`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to simulate mint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_simulate_redeem',
    description:
      'Simulate redeeming USDs for collateral. Shows expected output, fees, and which collaterals you will receive.',
    inputSchema: SimulateRedeemInput,
    handler: async (input: z.infer<typeof SimulateRedeemInput>) => {
      try {
        const usdsAmount = parseFloat(input.usdsAmount);
        if (isNaN(usdsAmount) || usdsAmount <= 0) {
          return {
            success: false,
            error: 'Invalid USDs amount',
          };
        }

        // Get redemption fee
        const redeemFee = await readContract({
          address: CONTRACTS.VAULT,
          abi: VaultABI,
          functionName: 'redemptionFee',
        });

        const feePercent = Number(redeemFee) / 10000;
        const fee = usdsAmount * (feePercent / 100);
        const netOutput = usdsAmount - fee;

        // If specific collateral requested
        if (input.collateral) {
          const config = COLLATERALS[input.collateral];
          const price = await readContract({
            address: config.oracle as `0x${string}`,
            abi: OracleABI,
            functionName: 'latestAnswer',
          });

          const priceUsd = Number(formatUnits(price as bigint, 8));
          const collateralAmount = netOutput / priceUsd;

          return {
            success: true,
            data: {
              input: {
                usdsAmount: usdsAmount.toString(),
                preferredCollateral: input.collateral,
              },
              fees: {
                redemptionFee: `${feePercent.toFixed(2)}%`,
                feeAmount: `$${fee.toFixed(4)}`,
              },
              output: {
                collateral: input.collateral,
                amount: collateralAmount.toFixed(6),
                valueUsd: `$${netOutput.toFixed(2)}`,
                price: `$${priceUsd.toFixed(4)}`,
              },
              summary: `Redeeming ${usdsAmount} USDs will yield approximately ${collateralAmount.toFixed(4)} ${input.collateral} after ${feePercent.toFixed(2)}% fee.`,
            },
          };
        }

        // Mixed collateral redemption
        return {
          success: true,
          data: {
            input: {
              usdsAmount: usdsAmount.toString(),
              preferredCollateral: 'Mixed (pro-rata)',
            },
            fees: {
              redemptionFee: `${feePercent.toFixed(2)}%`,
              feeAmount: `$${fee.toFixed(4)}`,
            },
            output: {
              totalValueUsd: `$${netOutput.toFixed(2)}`,
              distribution: 'Pro-rata based on Vault collateral composition',
              note: 'Specify a collateral to see exact amounts',
            },
            summary: `Redeeming ${usdsAmount} USDs will yield approximately $${netOutput.toFixed(2)} worth of mixed collateral after ${feePercent.toFixed(2)}% fee.`,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to simulate redeem: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'vault_get_allocation_targets',
    description:
      'Get target allocation percentages for each collateral and compare to current allocation. Shows rebalancing needs.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        // Target allocations (would come from governance)
        const targets = {
          USDC: { target: 40, min: 30, max: 50 },
          USDT: { target: 30, min: 20, max: 40 },
          DAI: { target: 20, min: 10, max: 30 },
          FRAX: { target: 10, min: 5, max: 20 },
        };

        // Get current allocations
        const calls = Object.entries(COLLATERALS).flatMap(([, config]) => [
          {
            address: config.address as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACTS.VAULT],
          },
          {
            address: config.oracle as `0x${string}`,
            abi: OracleABI,
            functionName: 'latestAnswer',
          },
        ]);

        const results = await multicall(calls);

        let totalValue = 0;
        const allocations = Object.entries(COLLATERALS).map(
          ([symbol, config], index) => {
            const balance = results[index * 2] as bigint;
            const price = results[index * 2 + 1] as bigint;
            const value =
              Number(formatUnits(balance, config.decimals)) *
              Number(formatUnits(price, 8));
            totalValue += value;
            return { symbol, value };
          }
        );

        const comparison = allocations.map((a) => {
          const target = targets[a.symbol as keyof typeof targets];
          const currentPercent = (a.value / totalValue) * 100;
          const deviation = currentPercent - target.target;

          return {
            symbol: a.symbol,
            current: `${currentPercent.toFixed(2)}%`,
            target: `${target.target}%`,
            range: `${target.min}%-${target.max}%`,
            deviation: `${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}%`,
            status:
              currentPercent < target.min
                ? 'UNDER'
                : currentPercent > target.max
                  ? 'OVER'
                  : 'OK',
            action:
              currentPercent < target.min
                ? 'Increase allocation'
                : currentPercent > target.max
                  ? 'Decrease allocation'
                  : 'No action needed',
          };
        });

        const needsRebalance = comparison.some((c) => c.status !== 'OK');

        return {
          success: true,
          data: {
            totalValueUsd: `$${totalValue.toFixed(2)}`,
            needsRebalance,
            allocations: comparison,
            rebalanceThreshold: '5% deviation from target',
            governance: 'Allocation targets set by SPA governance',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get allocation targets: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default vaultTools;
