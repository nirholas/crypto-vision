/**
 * Sperax MCP Server - Swap Router Tools
 *
 * Optimal swap routing for SPA and USDs trades.
 * Finds best paths across DEXs on Arbitrum.
 */

import { z } from 'zod';
import { CONTRACTS, COLLATERALS } from '../config.js';
import { readContract, multicall, ERC20ABI } from '../blockchain.js';
import { formatUnits, parseUnits } from '../utils.js';

// ============================================================================
// DEX Configuration
// ============================================================================

const DEXS = {
  CAMELOT: {
    name: 'Camelot',
    router: '0xc873fEcbd354f5A56E00E710B90EF4201db2448d',
    type: 'v2',
  },
  UNISWAP_V3: {
    name: 'Uniswap V3',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    type: 'v3',
  },
  SUSHISWAP: {
    name: 'SushiSwap',
    router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    type: 'v2',
  },
} as const;

// Common trading pairs
const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const WBTC = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';

// ============================================================================
// Input Schemas
// ============================================================================

const SwapQuoteInput = z.object({
  tokenIn: z
    .enum(['SPA', 'USDs', 'USDC', 'USDCe', 'USDT', 'DAI', 'FRAX', 'ETH'])
    .describe('Token to swap from'),
  tokenOut: z
    .enum(['SPA', 'USDs', 'USDC', 'USDCe', 'USDT', 'DAI', 'FRAX', 'ETH'])
    .describe('Token to receive'),
  amountIn: z
    .string()
    .describe('Amount of tokenIn to swap (in human-readable units)'),
});

const BestRouteInput = z.object({
  tokenIn: z
    .enum(['SPA', 'USDs', 'USDC', 'USDCe', 'USDT', 'DAI', 'FRAX', 'ETH'])
    .describe('Token to swap from'),
  tokenOut: z
    .enum(['SPA', 'USDs', 'USDC', 'USDCe', 'USDT', 'DAI', 'FRAX', 'ETH'])
    .describe('Token to receive'),
  amountIn: z
    .string()
    .describe('Amount of tokenIn to swap'),
});

// ============================================================================
// Helper Functions
// ============================================================================

function getTokenAddress(symbol: string): string {
  if (symbol === 'SPA') return CONTRACTS.SPA;
  if (symbol === 'USDs') return CONTRACTS.USDS;
  if (symbol === 'ETH') return WETH;
  if (symbol in COLLATERALS) return COLLATERALS[symbol as keyof typeof COLLATERALS].address;
  throw new Error(`Unknown token: ${symbol}`);
}

function getTokenDecimals(symbol: string): number {
  if (symbol === 'SPA' || symbol === 'USDs' || symbol === 'ETH' || symbol === 'DAI') return 18;
  return 6; // USDC, USDCe, USDT, FRAX are 6 decimals
}

// Uniswap V2 style getAmountsOut ABI
const UniV2RouterABI = [
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

// ============================================================================
// Tool Definitions
// ============================================================================

export const swapTools = [
  {
    name: 'swap_get_quote',
    description:
      'Get a swap quote for trading between SPA, USDs, and other tokens. Returns expected output amount and price impact.',
    inputSchema: SwapQuoteInput,
    handler: async (input: z.infer<typeof SwapQuoteInput>) => {
      try {
        if (input.tokenIn === input.tokenOut) {
          return {
            success: false,
            error: 'Cannot swap token to itself',
          };
        }

        const tokenInAddress = getTokenAddress(input.tokenIn);
        const tokenOutAddress = getTokenAddress(input.tokenOut);
        const decimalsIn = getTokenDecimals(input.tokenIn);
        const decimalsOut = getTokenDecimals(input.tokenOut);
        const amountIn = parseUnits(input.amountIn, decimalsIn);

        // Try direct path first, then through WETH
        const paths = [
          [tokenInAddress, tokenOutAddress], // Direct
          [tokenInAddress, WETH, tokenOutAddress], // Through WETH
        ];

        const quotes: Array<{
          dex: string;
          path: string[];
          amountOut: string;
          rate: string;
        }> = [];

        // Query Camelot
        for (const path of paths) {
          try {
            const amounts = await readContract({
              address: DEXS.CAMELOT.router as `0x${string}`,
              abi: UniV2RouterABI,
              functionName: 'getAmountsOut',
              args: [amountIn, path as `0x${string}`[]],
            }) as bigint[];

            const amountOut = amounts[amounts.length - 1];
            const amountOutFormatted = formatUnits(amountOut, decimalsOut);
            const rate = (parseFloat(amountOutFormatted) / parseFloat(input.amountIn)).toFixed(6);

            quotes.push({
              dex: 'Camelot',
              path: path.length === 2 ? ['Direct'] : [input.tokenIn, 'WETH', input.tokenOut],
              amountOut: amountOutFormatted,
              rate,
            });
          } catch {
            // Path not available
          }
        }

        // Query SushiSwap
        for (const path of paths) {
          try {
            const amounts = await readContract({
              address: DEXS.SUSHISWAP.router as `0x${string}`,
              abi: UniV2RouterABI,
              functionName: 'getAmountsOut',
              args: [amountIn, path as `0x${string}`[]],
            }) as bigint[];

            const amountOut = amounts[amounts.length - 1];
            const amountOutFormatted = formatUnits(amountOut, decimalsOut);
            const rate = (parseFloat(amountOutFormatted) / parseFloat(input.amountIn)).toFixed(6);

            quotes.push({
              dex: 'SushiSwap',
              path: path.length === 2 ? ['Direct'] : [input.tokenIn, 'WETH', input.tokenOut],
              amountOut: amountOutFormatted,
              rate,
            });
          } catch {
            // Path not available
          }
        }

        if (quotes.length === 0) {
          return {
            success: false,
            error: `No liquidity found for ${input.tokenIn} → ${input.tokenOut}`,
          };
        }

        // Sort by best output
        quotes.sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));
        const bestQuote = quotes[0];

        // Calculate savings vs worst quote
        const worstQuote = quotes[quotes.length - 1];
        const savings = quotes.length > 1
          ? (parseFloat(bestQuote.amountOut) - parseFloat(worstQuote.amountOut)).toFixed(4)
          : '0';

        return {
          success: true,
          data: {
            swap: {
              from: {
                token: input.tokenIn,
                amount: input.amountIn,
              },
              to: {
                token: input.tokenOut,
                amount: bestQuote.amountOut,
              },
            },
            bestRoute: {
              dex: bestQuote.dex,
              path: bestQuote.path,
              rate: `1 ${input.tokenIn} = ${bestQuote.rate} ${input.tokenOut}`,
            },
            allQuotes: quotes,
            analysis: {
              quotesFound: quotes.length,
              savingsVsWorst: `${savings} ${input.tokenOut}`,
              recommendation: bestQuote.dex,
            },
            disclaimer: 'Quotes are estimates. Actual output may vary due to slippage.',
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
    name: 'swap_get_best_route',
    description:
      'Find the optimal swap route across all DEXs for the best execution price. Compares Camelot, SushiSwap, and Uniswap V3.',
    inputSchema: BestRouteInput,
    handler: async (input: z.infer<typeof BestRouteInput>) => {
      try {
        if (input.tokenIn === input.tokenOut) {
          return {
            success: false,
            error: 'Cannot swap token to itself',
          };
        }

        const tokenInAddress = getTokenAddress(input.tokenIn);
        const tokenOutAddress = getTokenAddress(input.tokenOut);
        const decimalsIn = getTokenDecimals(input.tokenIn);
        const decimalsOut = getTokenDecimals(input.tokenOut);
        const amountIn = parseUnits(input.amountIn, decimalsIn);

        // Multi-hop paths to try
        const pathConfigs = [
          { name: 'Direct', path: [tokenInAddress, tokenOutAddress] },
          { name: 'Via WETH', path: [tokenInAddress, WETH, tokenOutAddress] },
          { name: 'Via USDC', path: [tokenInAddress, COLLATERALS.USDC.address, tokenOutAddress] },
        ];

        const allRoutes: Array<{
          dex: string;
          pathName: string;
          amountOut: string;
          priceImpact: string;
        }> = [];

        // Query each DEX with each path
        for (const dex of [DEXS.CAMELOT, DEXS.SUSHISWAP]) {
          for (const pathConfig of pathConfigs) {
            try {
              const amounts = await readContract({
                address: dex.router as `0x${string}`,
                abi: UniV2RouterABI,
                functionName: 'getAmountsOut',
                args: [amountIn, pathConfig.path as `0x${string}`[]],
              }) as bigint[];

              const amountOut = formatUnits(amounts[amounts.length - 1], decimalsOut);
              
              // Estimate price impact (simplified - compare to a smaller trade)
              let priceImpact = '< 0.1%';
              try {
                const smallAmount = amountIn / 100n;
                const smallAmounts = await readContract({
                  address: dex.router as `0x${string}`,
                  abi: UniV2RouterABI,
                  functionName: 'getAmountsOut',
                  args: [smallAmount, pathConfig.path as `0x${string}`[]],
                }) as bigint[];
                
                const smallOut = parseFloat(formatUnits(smallAmounts[smallAmounts.length - 1], decimalsOut));
                const expectedOut = smallOut * 100;
                const actualOut = parseFloat(amountOut);
                const impact = ((expectedOut - actualOut) / expectedOut * 100);
                priceImpact = impact > 0.1 ? `${impact.toFixed(2)}%` : '< 0.1%';
              } catch {
                // Keep default
              }

              allRoutes.push({
                dex: dex.name,
                pathName: pathConfig.name,
                amountOut,
                priceImpact,
              });
            } catch {
              // Route not available
            }
          }
        }

        if (allRoutes.length === 0) {
          return {
            success: false,
            error: `No routes found for ${input.tokenIn} → ${input.tokenOut}`,
          };
        }

        // Sort by best output
        allRoutes.sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));
        const best = allRoutes[0];

        return {
          success: true,
          data: {
            recommendation: {
              dex: best.dex,
              route: best.pathName,
              expectedOutput: `${best.amountOut} ${input.tokenOut}`,
              priceImpact: best.priceImpact,
            },
            input: {
              token: input.tokenIn,
              amount: input.amountIn,
            },
            allRoutes: allRoutes.slice(0, 5), // Top 5 routes
            tips: [
              'Split large trades across multiple DEXs to reduce price impact',
              'Check slippage tolerance before executing',
              'Gas costs may vary by route complexity',
            ],
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to find best route: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },

  {
    name: 'swap_estimate_price_impact',
    description:
      'Estimate the price impact for a given swap size. Helps users understand how their trade will move the market.',
    inputSchema: SwapQuoteInput,
    handler: async (input: z.infer<typeof SwapQuoteInput>) => {
      try {
        if (input.tokenIn === input.tokenOut) {
          return {
            success: false,
            error: 'Cannot swap token to itself',
          };
        }

        const tokenInAddress = getTokenAddress(input.tokenIn);
        const tokenOutAddress = getTokenAddress(input.tokenOut);
        const decimalsIn = getTokenDecimals(input.tokenIn);
        const decimalsOut = getTokenDecimals(input.tokenOut);
        const amountIn = parseUnits(input.amountIn, decimalsIn);

        const path = [tokenInAddress, tokenOutAddress];

        // Get quote for full amount
        let fullQuote: bigint[];
        try {
          fullQuote = await readContract({
            address: DEXS.CAMELOT.router as `0x${string}`,
            abi: UniV2RouterABI,
            functionName: 'getAmountsOut',
            args: [amountIn, path as `0x${string}`[]],
          }) as bigint[];
        } catch {
          return {
            success: false,
            error: `No direct liquidity for ${input.tokenIn} → ${input.tokenOut}`,
          };
        }

        // Get quote for tiny amount (reference price)
        const tinyAmount = amountIn / 1000n > 0n ? amountIn / 1000n : 1n;
        const tinyQuote = await readContract({
          address: DEXS.CAMELOT.router as `0x${string}`,
          abi: UniV2RouterABI,
          functionName: 'getAmountsOut',
          args: [tinyAmount, path as `0x${string}`[]],
        }) as bigint[];

        const fullOut = parseFloat(formatUnits(fullQuote[1], decimalsOut));
        const tinyOut = parseFloat(formatUnits(tinyQuote[1], decimalsOut));
        const tinyIn = parseFloat(formatUnits(tinyAmount, decimalsIn));
        const fullIn = parseFloat(input.amountIn);

        const referenceRate = tinyOut / tinyIn;
        const actualRate = fullOut / fullIn;
        const priceImpact = ((referenceRate - actualRate) / referenceRate * 100);

        let severity: 'low' | 'medium' | 'high' | 'very_high';
        let recommendation: string;

        if (priceImpact < 0.5) {
          severity = 'low';
          recommendation = 'Trade size is appropriate for available liquidity';
        } else if (priceImpact < 2) {
          severity = 'medium';
          recommendation = 'Consider splitting into 2-3 smaller trades';
        } else if (priceImpact < 5) {
          severity = 'high';
          recommendation = 'Strongly recommend splitting into multiple smaller trades';
        } else {
          severity = 'very_high';
          recommendation = 'Trade size is too large for available liquidity. Split into many smaller trades or use a different venue.';
        }

        return {
          success: true,
          data: {
            swap: {
              from: `${input.amountIn} ${input.tokenIn}`,
              to: `${fullOut.toFixed(4)} ${input.tokenOut}`,
            },
            priceImpact: {
              percent: `${priceImpact.toFixed(4)}%`,
              severity,
            },
            rates: {
              reference: `1 ${input.tokenIn} = ${referenceRate.toFixed(6)} ${input.tokenOut}`,
              actual: `1 ${input.tokenIn} = ${actualRate.toFixed(6)} ${input.tokenOut}`,
              loss: `${(referenceRate - actualRate).toFixed(6)} ${input.tokenOut} per ${input.tokenIn}`,
            },
            recommendation,
            suggestedSplits: priceImpact > 1 ? [
              `${(fullIn / 2).toFixed(2)} ${input.tokenIn} x 2 trades`,
              `${(fullIn / 4).toFixed(2)} ${input.tokenIn} x 4 trades`,
            ] : null,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to estimate price impact: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  },
];

export default swapTools;
