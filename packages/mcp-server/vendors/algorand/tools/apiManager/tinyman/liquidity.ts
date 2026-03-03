/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { AddLiquidity, poolUtils, SupportedNetwork } from '@tinymanorg/tinyman-js-sdk';
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

export const liquidityTools: Tool[] = [
  {
    name: 'api_tinyman_get_liquidity_quote',
    description: 'Get quote for adding liquidity to a pool',
    inputSchema: {
      type: 'object',
      properties: {
        asset1Id: {
          type: 'integer',
          description: 'ID of the first asset'
        },
        asset2Id: {
          type: 'integer',
          description: 'ID of the second asset'
        },
        asset1Amount: {
          type: 'integer',
          description: 'Amount of first asset to add'
        },
        asset2Amount: {
          type: 'integer',
          description: 'Amount of second asset to add'
        },
        mode: {
          type: 'string',
          enum: ['initial', 'flexible', 'singleAsset'],
          description: 'Mode of adding liquidity'
        },
        version: {
          type: 'string',
          enum: ['v1_1', 'v2'],
          description: 'Tinyman protocol version',
          default: 'v2'
        }
      },
      required: ['asset1Id', 'asset2Id', 'mode']
    }
  }
];

export async function handleLiquidityTools(args: any): Promise<any> {
  const { 
    name, 
    asset1Id, 
    asset2Id, 
    asset1Amount = 0,
    asset2Amount = 0,
    mode,
    version = 'v2'
  } = args;

  if (name === 'api_tinyman_get_liquidity_quote') {
    try {
      // Get pool information first
      const poolInfo = await (version === 'v2' 
        ? poolUtils.v2.getPoolInfo({
            client: algodClient,
            network: env.algorand_network as SupportedNetwork,
            asset1ID: asset1Id,
            asset2ID: asset2Id
          })
        : poolUtils.v1_1.getPoolInfo({
            client: algodClient,
            network: env.algorand_network as SupportedNetwork,
            asset1ID: asset1Id,
            asset2ID: asset2Id
          }));

      let quote;
      if (version === 'v2') {
        switch (mode) {
          case 'initial':
            quote = AddLiquidity.v2.initial.getQuote({
              pool: poolInfo,
              asset1: {
              amount: BigInt(asset1Amount),
              decimals: await getAssetDecimals(asset1Id)
              },
              asset2: {
              amount: BigInt(asset2Amount),
              decimals: await getAssetDecimals(asset2Id)
              }
            });
            break;
          case 'flexible':
            quote = AddLiquidity.v2.flexible.getQuote({
              pool: poolInfo,
              asset1: {
              amount: BigInt(asset1Amount),
              decimals: await getAssetDecimals(asset1Id)
              },
              asset2: {
              amount: BigInt(asset2Amount),
              decimals: await getAssetDecimals(asset2Id)
              }
            });
            break;
          case 'singleAsset':
            quote = AddLiquidity.v2.withSingleAsset.getQuote({
              pool: poolInfo,
              assetIn: {
                id: asset1Id,
                amount: BigInt(asset1Amount)
              },
              decimals: {
                asset1: await getAssetDecimals(asset1Id),
                asset2: await getAssetDecimals(asset2Id)
              }
            });
            break;
          default:
            throw new McpError(
              ErrorCode.InvalidParams,
              `Invalid liquidity mode: ${mode}`
            );
        }
      } else {
        // Get pool reserves for v1.1
        const reserves = await poolUtils.v1_1.getPoolReserves(algodClient, poolInfo);
        quote = AddLiquidity.v1_1.getQuote({
          pool: poolInfo,
          reserves,
          asset1In: BigInt(asset1Amount),
          asset2In: BigInt(asset2Amount)
        });
      }

      return quote;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get liquidity quote: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown liquidity tool: ${name}`
  );
}
