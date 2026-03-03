/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { poolUtils, SupportedNetwork } from '@tinymanorg/tinyman-js-sdk';
import { algodClient } from '../../../algorand-client.js';
import { env } from '../../../env.js';

export const analyticsTools: Tool[] = [
  {
    name: 'api_tinyman_get_pool_analytics',
    description: 'Get analytics for a Tinyman pool',
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
        version: {
          type: 'string',
          enum: ['v1_1', 'v2'],
          description: 'Tinyman protocol version',
          default: 'v2'
        }
      },
      required: ['asset1Id', 'asset2Id']
    }
  }
];

export async function handleAnalyticsTools(args: any): Promise<any> {
  const { 
    name, 
    asset1Id, 
    asset2Id,
    version = 'v2'
  } = args;

  if (name === 'api_tinyman_get_pool_analytics') {
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

      // Calculate pool analytics
      const isEmpty = poolUtils.isPoolEmpty(reserves);
      const pairRatio = poolUtils.getPoolPairRatio(reserves);

      const analytics = {
        status: poolInfo.status,
        isEmpty,
        pairRatio,
        reserves: {
          asset1: reserves.asset1.toString(),
          asset2: reserves.asset2.toString(),
          issuedLiquidity: reserves.issuedLiquidity.toString(),
          round: reserves.round
        }
      };

      return analytics;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pool analytics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown analytics tool: ${name}`
  );
}
