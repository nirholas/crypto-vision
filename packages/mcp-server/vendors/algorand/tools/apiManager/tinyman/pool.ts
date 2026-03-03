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

export const poolTools: Tool[] = [
  {
    name: 'api_tinyman_get_pool',
    description: 'Get Tinyman pool information by asset pair',
    inputSchema: {
      type: 'object',
      properties: {
        asset1Id: {
          type: 'integer',
          description: 'ID of the first asset in the pool'
        },
        asset2Id: {
          type: 'integer',
          description: 'ID of the second asset in the pool'
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

export async function handlePoolTools(args: any): Promise<any> {
  const { 
    name, 
    asset1Id, 
    asset2Id,
    version = 'v2'
  } = args;

  if (name === 'api_tinyman_get_pool') {
    try {
      // Get pool information
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

      // Get pool assets
      const assets = await (version === 'v2'
        ? poolUtils.v2.getPoolAssets({
            client: algodClient,
            address: poolInfo.account.address(),
            network: env.algorand_network as SupportedNetwork
          })
        : poolUtils.v1_1.getPoolAssets({
            client: algodClient,
            address: poolInfo.account.address(),
            network: env.algorand_network as SupportedNetwork
          }));

      const poolData = {
        status: poolInfo.status,
        validatorAppID: poolInfo.validatorAppID,
        poolTokenID: poolInfo.poolTokenID,
        assets,
        reserves: {
          asset1: reserves.asset1.toString(),
          asset2: reserves.asset2.toString(),
          issuedLiquidity: reserves.issuedLiquidity.toString(),
          round: reserves.round
        }
      };

      return poolData;
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pool information: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown pool tool: ${name}`
  );
}
