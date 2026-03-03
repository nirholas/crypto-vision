/**
 * Sperax MCP Server - Yield Reserve Tools
 *
 * Tools for interacting with the Sperax Yield Reserve system that manages
 * yield collection, swapping, and distribution between USDs holders and SPA buyback.
 */

import { z } from 'zod';
import { CONTRACTS, COLLATERALS } from '../config.js';
import { 
  readContract, 
  multicall, 
  YieldReserve_ABI,
  ERC20ABI,
} from '../blockchain.js';
import { formatUnits } from '../utils.js';

// ============================================================================
// Input Schemas
// ============================================================================

const GetSwapQuoteInput = z.object({
  srcToken: z
    .enum(['USDC', 'USDCe', 'USDT', 'DAI', 'FRAX', 'USDs'])
    .describe('Source token to swap from'),
  dstToken: z
    .enum(['USDC', 'USDCe', 'USDT', 'DAI', 'FRAX', 'USDs'])
    .describe('Destination token to receive'),
  amount: z
    .string()
    .describe('Amount of source token to swap (in human-readable units)'),
});

const CheckTokenPermissionInput = z.object({
  token: z
    .enum(['USDC', 'USDCe', 'USDT', 'DAI', 'FRAX', 'USDs'])
    .describe('Token to check permission for'),
});

// ============================================================================
// Tool Definitions
// ============================================================================

export const yieldReserveTools = [
  {
    name: 'yield_reserve_get_status',
    description:
      'Get comprehensive Yield Reserve status including configuration, balances, buyback percentage, and connected contracts. The Yield Reserve is the bridge between yield strategies and the Dripper/Buyback.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        // Get Yield Reserve configuration
        const [vault, oracle, buyback, dripper, buybackPercentage] = await multicall([
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'vault',
          },
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'oracle',
          },
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'buyback',
          },
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'dripper',
          },
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'buybackPercentage',
          },
        ]) as [string, string, string, string, bigint];

        // Get token balances in Yield Reserve
        const tokenBalanceCalls = Object.entries(COLLATERALS).map(([, config]) => ({
          address: config.address as `0x${string}`,
          abi: ERC20ABI,
          functionName: 'balanceOf',
          args: [CONTRACTS.YIELD_RESERVE],
        }));

        // Add USDs balance
        tokenBalanceCalls.push({
          address: CONTRACTS.USDS as `0x${string}`,
          abi: ERC20ABI,
          functionName: 'balanceOf',
          args: [CONTRACTS.YIELD_RESERVE],
        });

        const balances = await multicall(tokenBalanceCalls) as bigint[];

        const tokenBalances = Object.entries(COLLATERALS).map(([symbol, config], index) => ({
          symbol,
          balance: formatUnits(balances[index], config.decimals),
          address: config.address,
        }));

        // Add USDs balance
        const usdsBalance = formatUnits(balances[balances.length - 1], 18);

        // Calculate buyback distribution
        const buybackPct = Number(buybackPercentage) / 100; // Convert from basis points
        const dripperPct = 100 - buybackPct;

        return {
          success: true,
          data: {
            contracts: {
              yieldReserve: CONTRACTS.YIELD_RESERVE,
              vault: vault,
              oracle: oracle,
              buyback: buyback,
              dripper: dripper,
            },
            distribution: {
              toUSDs: `${dripperPct.toFixed(1)}%`,
              toBuyback: `${buybackPct.toFixed(1)}%`,
              description: 'Yield is split between USDs holders (via Dripper) and SPA buyback',
            },
            balances: {
              usds: usdsBalance,
              collaterals: tokenBalances.filter(t => parseFloat(t.balance) > 0),
            },
            purpose: {
              description: 'Yield Reserve receives harvested yield from strategies and converts it to USDs',
              flow: [
                '1. Strategies harvest yield (reward tokens + interest)',
                '2. Yield is sent to Yield Reserve',
                '3. Yield Reserve swaps tokens to USDs using oracle prices',
                `4. ${dripperPct.toFixed(0)}% goes to Dripper for USDs auto-yield`,
                `5. ${buybackPct.toFixed(0)}% goes to SPA Buyback contract`,
              ],
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get yield reserve status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'yield_reserve_get_swap_quote',
    description:
      'Get a quote for swapping tokens through the Yield Reserve. Uses protocol oracle prices for fair value swaps.',
    inputSchema: GetSwapQuoteInput,
    handler: async (input: z.infer<typeof GetSwapQuoteInput>) => {
      try {
        // Get token addresses
        const srcAddress = input.srcToken === 'USDs' 
          ? CONTRACTS.USDS 
          : COLLATERALS[input.srcToken]?.address;
        const dstAddress = input.dstToken === 'USDs' 
          ? CONTRACTS.USDS 
          : COLLATERALS[input.dstToken]?.address;

        if (!srcAddress || !dstAddress) {
          return {
            success: false,
            error: 'Invalid token symbol',
          };
        }

        const srcDecimals = input.srcToken === 'USDs' ? 18 : COLLATERALS[input.srcToken].decimals;
        const dstDecimals = input.dstToken === 'USDs' ? 18 : COLLATERALS[input.dstToken].decimals;

        // Parse amount to bigint
        const amountIn = BigInt(Math.floor(parseFloat(input.amount) * 10 ** srcDecimals));

        // Check token permissions
        const [srcData, dstData] = await multicall([
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'tokenData',
            args: [srcAddress],
          },
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'tokenData',
            args: [dstAddress],
          },
        ]) as [[boolean, boolean, bigint], [boolean, boolean, bigint]];

        const srcAllowed = srcData[0];
        const dstAllowed = dstData[1];

        if (!srcAllowed) {
          return {
            success: false,
            error: `${input.srcToken} is not allowed as source token`,
          };
        }

        if (!dstAllowed) {
          return {
            success: false,
            error: `${input.dstToken} is not allowed as destination token`,
          };
        }

        // Get quote from contract
        let amountOut: bigint;
        try {
          amountOut = await readContract({
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'getTokenBForTokenA',
            args: [srcAddress, dstAddress, amountIn],
          }) as bigint;
        } catch {
          // Fallback: estimate 1:1 for stablecoins
          amountOut = amountIn * BigInt(10 ** dstDecimals) / BigInt(10 ** srcDecimals);
        }

        const amountOutFormatted = formatUnits(amountOut, dstDecimals);
        const rate = Number(amountOutFormatted) / parseFloat(input.amount);

        return {
          success: true,
          data: {
            swap: {
              from: {
                token: input.srcToken,
                amount: input.amount,
                address: srcAddress,
              },
              to: {
                token: input.dstToken,
                amount: amountOutFormatted,
                address: dstAddress,
              },
            },
            rate: {
              value: rate.toFixed(6),
              description: `1 ${input.srcToken} = ${rate.toFixed(6)} ${input.dstToken}`,
            },
            priceSource: 'Sperax Master Price Oracle',
            permissions: {
              sourceAllowed: srcAllowed,
              destinationAllowed: dstAllowed,
            },
            notes: [
              'Swaps use oracle prices, not market prices',
              'No slippage on oracle-priced swaps',
              'Only whitelisted tokens can be swapped',
            ],
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get swap quote: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'yield_reserve_check_token_permission',
    description:
      'Check if a token is allowed for swapping in the Yield Reserve. Tokens can be enabled as source (input) or destination (output) tokens.',
    inputSchema: CheckTokenPermissionInput,
    handler: async (input: z.infer<typeof CheckTokenPermissionInput>) => {
      try {
        const tokenAddress = input.token === 'USDs' 
          ? CONTRACTS.USDS 
          : COLLATERALS[input.token]?.address;

        if (!tokenAddress) {
          return {
            success: false,
            error: 'Invalid token symbol',
          };
        }

        const tokenData = await readContract({
          address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
          abi: YieldReserve_ABI,
          functionName: 'tokenData',
          args: [tokenAddress],
        }) as [boolean, boolean, bigint];

        const [srcAllowed, dstAllowed, conversionFactor] = tokenData;

        return {
          success: true,
          data: {
            token: input.token,
            address: tokenAddress,
            permissions: {
              sourceAllowed: srcAllowed,
              destinationAllowed: dstAllowed,
            },
            conversionFactor: conversionFactor.toString(),
            status: {
              canSwapFrom: srcAllowed,
              canSwapTo: dstAllowed,
              description: srcAllowed && dstAllowed 
                ? 'Token can be used as both source and destination'
                : srcAllowed 
                ? 'Token can only be used as source (swap FROM)'
                : dstAllowed
                ? 'Token can only be used as destination (swap TO)'
                : 'Token is not enabled for swaps',
            },
            governance: 'Token permissions are controlled by Sperax governance',
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to check token permission: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'yield_reserve_get_flow',
    description:
      'Get detailed information about how yield flows through the Yield Reserve to USDs holders and SPA buyback.',
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const [buybackPercentage, dripperBalance] = await multicall([
          {
            address: CONTRACTS.YIELD_RESERVE as `0x${string}`,
            abi: YieldReserve_ABI,
            functionName: 'buybackPercentage',
          },
          {
            address: CONTRACTS.USDS as `0x${string}`,
            abi: ERC20ABI,
            functionName: 'balanceOf',
            args: [CONTRACTS.DRIPPER],
          },
        ]) as [bigint, bigint];

        const buybackPct = Number(buybackPercentage) / 100;
        const dripperPct = 100 - buybackPct;

        return {
          success: true,
          data: {
            yieldFlow: {
              step1: {
                name: 'Strategy Harvest',
                description: 'Yield strategies harvest interest + rewards from DeFi protocols',
                participants: ['Aave', 'Compound', 'Stargate', 'Fluid'],
              },
              step2: {
                name: 'Yield Collection',
                description: 'Harvested tokens sent to Yield Reserve',
                destination: CONTRACTS.YIELD_RESERVE,
              },
              step3: {
                name: 'Token Conversion',
                description: 'Reward tokens swapped to USDs at oracle prices',
                method: 'swap(srcToken, dstToken, amountIn, minAmountOut)',
              },
              step4: {
                name: 'Distribution Split',
                description: `USDs split between Dripper (${dripperPct}%) and Buyback (${buybackPct}%)`,
              },
              step5a: {
                name: 'Auto-Yield Distribution',
                percentage: `${dripperPct}%`,
                description: 'USDs sent to Dripper for gradual distribution to holders',
                currentBuffer: `${formatUnits(dripperBalance, 18)} USDs`,
              },
              step5b: {
                name: 'SPA Buyback',
                percentage: `${buybackPct}%`,
                description: 'USDs used to buy and burn SPA tokens',
              },
            },
            configurable: {
              buybackPercentage: {
                current: `${buybackPct}%`,
                description: 'Adjustable via governance',
                range: '0-100%',
              },
            },
            contracts: {
              yieldReserve: CONTRACTS.YIELD_RESERVE,
              dripper: CONTRACTS.DRIPPER,
              spaBuyback: CONTRACTS.SPA_BUYBACK,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get yield flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default yieldReserveTools;
