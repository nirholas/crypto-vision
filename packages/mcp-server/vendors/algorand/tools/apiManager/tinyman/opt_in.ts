/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { generateOptIntoAssetTxns, generateOptIntoValidatorTxns, generateOptOutOfValidatorTxns, SupportedNetwork } from '@tinymanorg/tinyman-js-sdk';
import { algodClient } from '../../../algorand-client.js';
import { env } from '../../../env.js';

export const optInTools: Tool[] = [
  {
    name: 'api_tinyman_get_asset_optin_quote',
    description: 'Get quote for opting into a Tinyman pool token',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'integer',
          description: 'ID of the pool token asset'
        },
        initiatorAddr: {
          type: 'string',
          description: 'Address of the account to opt in'
        }
      },
      required: ['assetId', 'initiatorAddr']
    }
  },
  {
    name: 'api_tinyman_get_validator_optin_quote',
    description: 'Get quote for opting into Tinyman validator app',
    inputSchema: {
      type: 'object',
      properties: {
        initiatorAddr: {
          type: 'string',
          description: 'Address of the account to opt in'
        },
        version: {
          type: 'string',
          enum: ['v1_1', 'v2'],
          description: 'Tinyman protocol version',
          default: 'v2'
        }
      },
      required: ['initiatorAddr']
    }
  },
  {
    name: 'api_tinyman_get_validator_optout_quote',
    description: 'Get quote for opting out of Tinyman validator app',
    inputSchema: {
      type: 'object',
      properties: {
        initiatorAddr: {
          type: 'string',
          description: 'Address of the account to opt out'
        },
        version: {
          type: 'string',
          enum: ['v1_1', 'v2'],
          description: 'Tinyman protocol version',
          default: 'v2'
        }
      },
      required: ['initiatorAddr']
    }
  }
];

export async function handleOptInTools(args: any): Promise<any> {
  const { name, initiatorAddr, version = 'v2' } = args;

  try {
    let quote;
    
    if (name === 'api_tinyman_get_asset_optin_quote') {
      const { assetId } = args;
      quote = await generateOptIntoAssetTxns({
        client: algodClient,
        assetID: assetId,
        initiatorAddr
      });
    }
    else if (name === 'api_tinyman_get_validator_optin_quote') {
      quote = await generateOptIntoValidatorTxns({
        client: algodClient,
        network: env.algorand_network as SupportedNetwork,
        contractVersion: version,
        initiatorAddr
      });
    }
    else if (name === 'api_tinyman_get_validator_optout_quote') {
      quote = await generateOptOutOfValidatorTxns({
        client: algodClient,
        network: env.algorand_network as SupportedNetwork,
        contractVersion: version,
        initiatorAddr
      });
    }
    else {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown opt-in tool: ${name}`
      );
    }

    return {
        version,
        initiatorAddr,
        transactionCount: quote.length,
        estimatedFees: quote.reduce((sum, txn) => sum + txn.txn.fee, 0)
      };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get opt-in/out quote: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
