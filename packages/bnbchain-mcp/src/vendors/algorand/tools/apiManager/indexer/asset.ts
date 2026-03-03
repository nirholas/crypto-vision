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
  AssetResponse,
  AssetsResponse,
  AssetBalancesResponse,
  TransactionsResponse
} from 'algosdk/dist/types/client/v2/indexer/models/types';

export const assetTools = [
  {
    name: 'api_indexer_lookup_asset_by_id',
    description: 'Get asset information and configuration',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'integer',
          description: 'Asset ID'
        }
      },
      required: ['assetId']
    }
  },
  {
    name: 'api_indexer_lookup_asset_balances',
    description: 'Get accounts holding this asset and their balances',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'integer',
          description: 'Asset ID'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of balances to return'
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
        },
        address: {
          type: 'string',
          description: 'Filter by account address'
        }
      },
      required: ['assetId']
    }
  },
  {
    name: 'api_indexer_lookup_asset_transactions',
    description: 'Get transactions involving this asset',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: {
          type: 'integer',
          description: 'Asset ID'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of transactions to return'
        },
        beforeTime: {
          type: 'string',
          description: 'Only return transactions before this time'
        },
        afterTime: {
          type: 'string',
          description: 'Only return transactions after this time'
        },
        minRound: {
          type: 'integer',
          description: 'Only return transactions after this round'
        },
        maxRound: {
          type: 'integer',
          description: 'Only return transactions before this round'
        },
        address: {
          type: 'string',
          description: 'Filter by account address'
        },
        addressRole: {
          type: 'string',
          description: 'Filter by address role (sender or receiver)'
        },
        excludeCloseTo: {
          type: 'boolean',
          description: 'Whether to exclude close-to transactions'
        },
        nextToken: {
          type: 'string',
          description: 'Token for retrieving the next page of results'
        },
        txid: {
          type: 'string',
          description: 'Filter by transaction ID'
        }
      },
      required: ['assetId']
    }
  },
  {
    name: 'api_indexer_search_for_assets',
    description: 'Search for assets with various criteria',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum number of assets to return'
        },
        creator: {
          type: 'string',
          description: 'Filter by creator address'
        },
        name: {
          type: 'string',
          description: 'Filter by asset name'
        },
        unit: {
          type: 'string',
          description: 'Filter by asset unit name'
        },
        assetId: {
          type: 'integer',
          description: 'Filter by asset ID'
        },
        nextToken: {
          type: 'string',
          description: 'Token for retrieving the next page of results'
        }
      }
    }
  }
];

export async function lookupAssetByID(assetId: number): Promise<AssetResponse> {
  try {
    console.log(`Looking up asset info for ID ${assetId}`);
    const response = await indexerClient.lookupAssetByID(assetId).do() as AssetResponse;
    console.log('Asset response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Asset lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get asset info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupAssetBalances(assetId: number, params?: {
  limit?: number;
  currencyGreaterThan?: number;
  currencyLessThan?: number;
  nextToken?: string;
  address?: string;
}): Promise<AssetBalancesResponse> {
  try {
    console.log(`Looking up balances for asset ${assetId}`);
    let search = indexerClient.lookupAssetBalances(assetId);

    if (params?.limit) {
      search = search.limit(params.limit);
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

    const response = await search.do() as AssetBalancesResponse;
    console.log('Asset balances response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Asset balances lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get asset balances: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupAssetTransactions(assetId: number, params?: {
  limit?: number;
  beforeTime?: string;
  afterTime?: string;
  minRound?: number;
  maxRound?: number;
  address?: string;
  addressRole?: string;
  excludeCloseTo?: boolean;
  nextToken?: string;
  txid?: string;
}): Promise<TransactionsResponse> {
  try {
    console.log(`Looking up transactions for asset ${assetId}`);
    let search = indexerClient.lookupAssetTransactions(assetId);

    if (params?.limit) {
      search = search.limit(params.limit);
    }
    if (params?.beforeTime) {
      search = search.beforeTime(params.beforeTime);
    }
    if (params?.afterTime) {
      search = search.afterTime(params.afterTime);
    }
    if (params?.minRound) {
      search = search.minRound(params.minRound);
    }
    if (params?.maxRound) {
      search = search.maxRound(params.maxRound);
    }
    if (params?.address) {
      search = search.address(params.address);
    }
    if (params?.addressRole) {
      search = search.addressRole(params.addressRole);
    }
    if (params?.excludeCloseTo) {
      search = search.excludeCloseTo(params.excludeCloseTo);
    }
    if (params?.nextToken) {
      search = search.nextToken(params.nextToken);
    }

    const response = await search.do() as TransactionsResponse;
    console.log('Asset transactions response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Asset transactions lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get asset transactions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function searchForAssets(params?: {
  limit?: number;
  creator?: string;
  name?: string;
  unit?: string;
  assetId?: number;
  nextToken?: string;
}): Promise<AssetsResponse> {
  try {
    console.log('Searching assets with params:', params);
    let search = indexerClient.searchForAssets();

    if (params?.limit) {
      search = search.limit(params.limit);
    }
    if (params?.creator) {
      search = search.creator(params.creator);
    }
    if (params?.name) {
      search = search.name(params.name);
    }
    if (params?.unit) {
      search = search.unit(params.unit);
    }
    if (params?.assetId) {
      search = search.index(params.assetId);
    }
    if (params?.nextToken) {
      search = search.nextToken(params.nextToken);
    }

    const response = await search.do() as AssetsResponse;
    console.log('Search assets response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Search assets error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search assets: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const handleAssetTools = ResponseProcessor.wrapResourceHandler(async function handleAssetTools(args: any): Promise<any> {
  const name = args.name;
  
  switch (name) {
    case 'api_indexer_lookup_asset_by_id': {
      const { assetId } = args;
      const info = await lookupAssetByID(assetId);
      return info.asset;
    }
    case 'api_indexer_lookup_asset_balances': {
      const { assetId, ...params } = args;
      const balances = await lookupAssetBalances(assetId, params);
      return balances.balances;
    }
    case 'api_indexer_lookup_asset_transactions': {
      const { assetId, ...params } = args;
      const transactions = await lookupAssetTransactions(assetId, params);
      return transactions.transactions;
    }
    case 'api_indexer_search_for_assets': {
      const assets = await searchForAssets(args);
      return assets.assets;
    }
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
});
