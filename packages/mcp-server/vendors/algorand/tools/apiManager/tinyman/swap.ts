/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Swap, poolUtils, SwapType, SupportedNetwork } from '@tinymanorg/tinyman-js-sdk';
import { algodClient } from '../../../algorand-client.js';
import { env } from '../../../env.js';

async function getAssetDecimals(assetId: number): Promise<number> {
  try {
    if (assetId === 0) return 6; // Algo has 6 decimals
    const assetInfo = await algodClient.getAssetByID(assetId).do();
    return assetInfo.params.decimals;
  } catch (error) {
    console.error(`Failed to get decimals for asset ${assetId}:`, error);
    return 6; // Default to 6 decimals if we can't get the info
  }
}

export const swapTools: Tool[] = [
  {
    name: 'api_tinyman_get_swap_quote',
    description: 'Get quote for swapping assets',
    inputSchema: {
      type: 'object',
      properties: {
        assetIn: {
          type: 'integer',
          description: 'ID of the input asset'
        },
        assetOut: {
          type: 'integer',
          description: 'ID of the output asset'
        },
        amount: {
          type: 'integer',
          description: 'Amount to swap'
        },
        mode: {
          type: 'string',
          enum: ['fixedInput', 'fixedOutput'],
          description: 'Mode of swap'
        },
        version: {
          type: 'string',
          enum: ['v1_1', 'v2'],
          description: 'Tinyman protocol version',
          default: 'v2'
        }
      },
      required: ['assetIn', 'assetOut', 'amount', 'mode']
    }
  }
];

export async function handleSwapTools(args: any): Promise<any> {
  const { 
    name, 
    assetIn, 
    assetOut, 
    amount,
    mode,
    version = 'v2'
  } = args;

  if (name === 'api_tinyman_get_swap_quote') {
    try {
      // Get pool information first
      const poolInfo = await (version === 'v2' 
        ? poolUtils.v2.getPoolInfo({
            client: algodClient,
            network: env.algorand_network as SupportedNetwork,
            asset1ID: assetIn,
            asset2ID: assetOut
          })
        : poolUtils.v1_1.getPoolInfo({
            client: algodClient,
            network: env.algorand_network as SupportedNetwork,
            asset1ID: assetIn,
            asset2ID: assetOut
          }));

      // Get asset decimals
      const [assetInDecimals, assetOutDecimals] = await Promise.all([
        getAssetDecimals(assetIn),
        getAssetDecimals(assetOut)
      ]);

      let quote;
      if (version === 'v2') {
        if (mode === 'fixedInput') {
          quote = await Swap.v2.getQuote({
            assetIn: {
              id: assetIn,
              decimals: assetInDecimals
            },
            assetOut: {
              id: assetOut,
              decimals: assetOutDecimals
            },
            pool: poolInfo,
            amount: BigInt(amount),
            type: SwapType.FixedInput,
            network: env.algorand_network as SupportedNetwork,
            slippage: 0.01 // 1% slippage
          });
        } else {
          quote = await Swap.v2.getQuote({
            assetIn: {
              id: assetIn,
              decimals: assetInDecimals
            },
            assetOut: {
              id: assetOut,
              decimals: assetOutDecimals
            },
            pool: poolInfo,
            amount: BigInt(amount),
            type: SwapType.FixedOutput,
            network: env.algorand_network as SupportedNetwork,
            slippage: 0.01
          });
        }
      } else {
        // Get pool reserves for v1.1
        const reserves = await poolUtils.v1_1.getPoolReserves(algodClient, poolInfo);
        if (mode === 'fixedInput') {
          quote = Swap.v1_1.getQuote(
            SwapType.FixedInput,
            poolInfo,
            reserves,
            {
              id: assetIn,
              amount: BigInt(amount)
            },
            {
              assetIn: assetInDecimals,
              assetOut: assetOutDecimals
            }
          );
        } else {
          quote = Swap.v1_1.getQuote(
            SwapType.FixedOutput,
            poolInfo,
            reserves,
            {
              id: assetOut,
              amount: BigInt(amount)
            },
            {
              assetIn: assetInDecimals,
              assetOut: assetOutDecimals
            }
          );
        }
      }

      return quote;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get swap quote: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown swap tool: ${name}`
  );
}
