/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { RemoveLiquidity, poolUtils, SupportedNetwork } from '@tinymanorg/tinyman-js-sdk';
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

export const removeLiquidityTools: Tool[] = [
  {
    name: 'api_tinyman_get_remove_liquidity_quote',
    description: 'Get quote for removing liquidity from a pool',
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
        poolTokenAmount: {
          type: 'integer',
          description: 'Amount of pool tokens to burn'
        },
        initiatorAddr: {
          type: 'string',
          description: 'Address of the account removing liquidity'
        },
        slippage: {
          type: 'number',
          description: 'Maximum acceptable slippage (e.g., 0.01 for 1%)',
          default: 0.01
        },
        singleAssetMode: {
          type: 'boolean',
          description: 'Whether to remove liquidity in single asset mode (v2 only)',
          default: false
        },
        version: {
          type: 'string',
          enum: ['v1_1', 'v2'],
          description: 'Tinyman protocol version',
          default: 'v2'
        }
      },
      required: ['asset1Id', 'asset2Id', 'poolTokenAmount', 'initiatorAddr']
    }
  }
];

export async function handleRemoveLiquidityTools(args: any): Promise<any> {
  const { 
    name, 
    asset1Id, 
    asset2Id,
    poolTokenAmount,
    initiatorAddr,
    slippage = 0.01,
    singleAssetMode = false,
    version = 'v2'
  } = args;

  if (name === 'api_tinyman_get_remove_liquidity_quote') {
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

      // Get pool reserves
      const reserves = await (version === 'v2'
        ? poolUtils.v2.getPoolReserves(algodClient, poolInfo)
        : poolUtils.v1_1.getPoolReserves(algodClient, poolInfo));

      // Get asset decimals
      const [asset1Decimals, asset2Decimals] = await Promise.all([
        getAssetDecimals(asset1Id),
        getAssetDecimals(asset2Id)
      ]);

      let quote;
      if (version === 'v2') {
        if (singleAssetMode) {
          quote = await RemoveLiquidity.v2.generateSingleAssetOutTxns({
            client: algodClient,
            pool: poolInfo,
            outputAssetId: asset1Id,
            poolTokenIn: BigInt(poolTokenAmount),
            initiatorAddr,
            minOutputAssetAmount: BigInt(0), // Will be calculated based on slippage
            slippage
          });
        } else {
          quote = await RemoveLiquidity.v2.generateTxns({
            client: algodClient,
            pool: poolInfo,
            poolTokenIn: BigInt(poolTokenAmount),
            initiatorAddr,
            minAsset1Amount: BigInt(0), // Will be calculated based on slippage
            minAsset2Amount: BigInt(0), // Will be calculated based on slippage
            slippage
          });
        }
      } else {
        // Calculate expected output amounts based on pool reserves and input amount
        const poolShare = poolUtils.getPoolShare(reserves.issuedLiquidity, BigInt(poolTokenAmount));
        const asset1Out = (reserves.asset1 * BigInt(Math.floor(poolShare * 1000))) / BigInt(1000);
        const asset2Out = (reserves.asset2 * BigInt(Math.floor(poolShare * 1000))) / BigInt(1000);

        quote = await RemoveLiquidity.v1_1.generateTxns({
          client: algodClient,
          pool: poolInfo,
          poolTokenIn: BigInt(poolTokenAmount),
          asset1Out,
          asset2Out,
          slippage,
          initiatorAddr
        });
      }

      return {
        version,
        asset1Id,
        asset2Id,
        poolTokenAmount,
        singleAssetMode,
        quote
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get remove liquidity quote: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown remove liquidity tool: ${name}`
  );
}
