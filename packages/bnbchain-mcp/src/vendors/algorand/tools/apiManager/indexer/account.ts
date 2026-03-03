/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { indexerClient } from '../../../algorand-client.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import type {
  AccountResponse,
  AccountsResponse,
  ApplicationLocalStatesResponse,
  AssetHoldingsResponse,
  ApplicationsResponse,
  TransactionsResponse
} from 'algosdk/dist/types/client/v2/indexer/models/types';

export const accountTools = [
  {
    name: 'api_indexer_lookup_account_by_id',
    description: 'Get account information from indexer',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Account address'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'api_indexer_lookup_account_assets',
    description: 'Get account assets',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Account address'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of assets to return'
        },
        assetId: {
          type: 'integer',
          description: 'Filter by asset ID'
        },
        nextToken: {
          type: 'string',
          description: 'Token for retrieving the next page of results'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'api_indexer_lookup_account_app_local_states',
    description: 'Get account application local states',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Account address'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'api_indexer_lookup_account_created_applications',
    description: 'Get applications created by this account',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Account address'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'api_indexer_search_for_accounts',
    description: 'Search for accounts with various criteria',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum number of accounts to return'
        },
        assetId: {
          type: 'integer',
          description: 'Filter by asset ID'
        },
        applicationId: {
          type: 'integer',
          description: 'Filter by application ID'
        },
        currencyGreaterThan: {
          type: 'integer',
          description: 'Filter by minimum balance'
        },
        currencyLessThan: {
          type: 'integer',
          description: 'Filter by maximum balance'
        },
        nextToken: {
          type: 'string',
          description: 'Token for retrieving the next page of results'
        }
      }
    }
  }
];

export async function lookupAccountByID(address: string): Promise<AccountResponse> {
  try {
    console.log(`Looking up account info for address ${address}`);
    const response = await indexerClient.lookupAccountByID(address).do() as AccountResponse;
    console.log('Account response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Account lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get account info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupAccountAssets(address: string, params?: {
  limit?: number;
  assetId?: number;
  nextToken?: string;
}): Promise<AssetHoldingsResponse> {
  try {
    console.log(`Looking up assets for address ${address}`);
    let search = indexerClient.lookupAccountAssets(address);

    if (params?.limit) {
      search = search.limit(params.limit);
    }
    if (params?.assetId) {
      search = search.assetId(params.assetId);
    }
    if (params?.nextToken) {
      search = search.nextToken(params.nextToken);
    }

    const response = await search.do() as AssetHoldingsResponse;
    console.log('Assets response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Assets lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get account assets: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupAccountAppLocalStates(address: string): Promise<ApplicationLocalStatesResponse> {
  try {
    console.log(`Looking up app local states for address ${address}`);
    const response = await indexerClient.lookupAccountAppLocalStates(address).do() as ApplicationLocalStatesResponse;
    console.log('App local states response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('App local states lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get account application local states: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupAccountCreatedApplications(address: string): Promise<ApplicationsResponse> {
  try {
    console.log(`Looking up created applications for address ${address}`);
    const response = await indexerClient.lookupAccountCreatedApplications(address).do() as ApplicationsResponse;
    console.log('Created applications response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Created applications lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get account created applications: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function searchAccounts(params?: {
  limit?: number;
  assetId?: number;
  applicationId?: number;
  currencyGreaterThan?: number;
  currencyLessThan?: number;
  nextToken?: string;
}): Promise<AccountsResponse> {
  try {
    console.log('Searching accounts with params:', params);
    let search = indexerClient.searchAccounts();

    if (params?.limit) {
      search = search.limit(params.limit);
    }
    if (params?.assetId) {
      search = search.assetID(params.assetId);
    }
    if (params?.applicationId) {
      search = search.applicationID(params.applicationId);
    }
    if (params?.currencyGreaterThan) {
      search = search.currencyGreaterThan(params.currencyGreaterThan);
    }
    if (params?.currencyLessThan) {
      search = search.currencyLessThan(params.currencyLessThan);
    }
    if (params?.nextToken) {
      search = search.nextToken(params.nextToken);
    }

    const response = await search.do() as AccountsResponse;
    console.log('Search accounts response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Search accounts error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search accounts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const handleAccountTools = ResponseProcessor.wrapResourceHandler(async function handleAccountTools(args: any): Promise<any> {
  const name = args.name;
  
  switch (name) {
    case 'api_indexer_lookup_account_by_id': {
      const { address } = args;
      const info = await lookupAccountByID(address);
      return info;
    }
    case 'api_indexer_lookup_account_app_local_states': {
      const { address } = args;
      const info = await lookupAccountAppLocalStates(address);
      return info;
    }
    case 'api_indexer_lookup_account_created_applications': {
      const { address } = args;
      const info = await lookupAccountCreatedApplications(address);
      return info.applications;
    }
    case 'api_indexer_search_for_accounts': {
      const info = await searchAccounts(args);
      return info.accounts;
    }
    case 'api_indexer_lookup_account_assets': {
      const { address, ...params } = args;
      const info = await lookupAccountAssets(address, params);
      return info.assets;
    }
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
});
