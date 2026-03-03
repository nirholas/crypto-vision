/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Bootstrap, SupportedNetwork } from '@tinymanorg/tinyman-js-sdk';
import { algodClient } from '../../../algorand-client.js';
import { env } from '../../../env.js';

export const bootstrapTools: Tool[] = [
  {
    name: 'api_tinyman_get_pool_creation_quote',
    description: 'Get quote for creating a new Tinyman pool',
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
        initiatorAddr: {
          type: 'string',
          description: 'Address of the account creating the pool'
        },
        version: {
          type: 'string',
          enum: ['v1_1', 'v2'],
          description: 'Tinyman protocol version',
          default: 'v2'
        }
      },
      required: ['asset1Id', 'asset2Id', 'initiatorAddr']
    }
  }
];

export async function handleBootstrapTools(args: any): Promise<any> {
  const { 
    name, 
    asset1Id, 
    asset2Id,
    initiatorAddr,
    version = 'v2'
  } = args;

  if (name === 'api_tinyman_get_pool_creation_quote') {
    try {
      const quote = await (version === 'v2'
        ? Bootstrap.v2.generateTxns({
            client: algodClient,
            network: env.algorand_network as SupportedNetwork,
            asset_1: {
              id: asset1Id.toString(),
              unit_name: ''
            },
            asset_2: {
              id: asset2Id.toString(),
              unit_name: ''
            },
            initiatorAddr
          })
        : Bootstrap.v1_1.generateTxns({
            client: algodClient,
            network: env.algorand_network as SupportedNetwork,
            asset_1: {
              id: asset1Id.toString(),
              unit_name: ''
            },
            asset_2: {
              id: asset2Id.toString(),
              unit_name: ''
            },
            initiatorAddr
          }));

      return {
        version,
        asset1Id,
        asset2Id,
        transactionCount: quote.length,
        estimatedFees: quote.reduce((sum, txn) => sum + txn.txn.fee, 0)
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get pool creation quote: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown bootstrap tool: ${name}`
  );
}
