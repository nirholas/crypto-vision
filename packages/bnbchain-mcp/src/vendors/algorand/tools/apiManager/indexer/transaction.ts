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
  TransactionResponse,
  TransactionsResponse 
} from 'algosdk/dist/types/client/v2/indexer/models/types';

export const transactionTools = [
  {
    name: 'api_indexer_lookup_transaction_by_id',
    description: 'Get transaction information by ID',
    inputSchema: {
      type: 'object',
      properties: {
        txId: {
          type: 'string',
          description: 'Transaction ID'
        }
      },
      required: ['txId']
    }
  },
  {
    name: 'api_indexer_lookup_account_transactions',
    description: 'Get account transaction history',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Account address'
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
        txType: {
          type: 'string',
          description: 'Filter by transaction type'
        },
        assetId: {
          type: 'integer',
          description: 'Filter by asset ID'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'api_indexer_search_for_transactions',
    description: 'Search for transactions with various criteria',
    inputSchema: {
      type: 'object',
      properties: {
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
        txType: {
          type: 'string',
          description: 'Filter by transaction type'
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
          description: 'Filter by minimum amount'
        },
        currencyLessThan: {
          type: 'integer',
          description: 'Filter by maximum amount'
        },
        round: {
          type: 'integer',
          description: 'Filter by specific round'
        },
        nextToken: {
          type: 'string',
          description: 'Token for retrieving the next page of results'
        }
      }
    }
  }
];

export async function lookupTransactionByID(txId: string): Promise<TransactionResponse> {
  try {
    console.log(`Looking up transaction with ID ${txId}`);
    const response = await indexerClient.lookupTransactionByID(txId).do() as TransactionResponse;
    // Log only metadata instead of full response
    console.log('Transaction response metadata:', {
      currentRound: response.currentRound,
      transaction: response.transaction ? 'present' : 'not found'
    });
    return response;
  } catch (error) {
    console.error('Transaction lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function lookupAccountTransactions(address: string, params?: {
  limit?: number;
  beforeTime?: string;
  afterTime?: string;
  minRound?: number;
  maxRound?: number;
  txType?: string;
  assetId?: number;
}): Promise<TransactionsResponse> {
  try {
    console.log(`Looking up transactions for account ${address}`);
    let search = indexerClient.lookupAccountTransactions(address);

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
    if (params?.txType) {
      search = search.txType(params.txType);
    }
    if (params?.assetId) {
      search = search.assetID(params.assetId);
    }

    const response = await search.do() as TransactionsResponse;
    // Log only metadata instead of full response
    console.log('Account transactions response metadata:', {
      currentRound: response.currentRound,
      nextToken: response.nextToken,
      transactionCount: response.transactions?.length || 0
    });
    return response;
  } catch (error) {
    console.error('Account transactions lookup error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get account transactions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function searchForTransactions(params?: {
  limit?: number;
  beforeTime?: string;
  afterTime?: string;
  minRound?: number;
  maxRound?: number;
  address?: string;
  addressRole?: string;
  txType?: string;
  assetId?: number;
  applicationId?: number;
  currencyGreaterThan?: number;
  currencyLessThan?: number;
  round?: number;
  nextToken?: string;
}): Promise<TransactionsResponse> {
  try {
    console.log('Searching transactions with params:', params);
    let search = indexerClient.searchForTransactions();

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
    if (params?.txType) {
      search = search.txType(params.txType);
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
    if (params?.round) {
      search = search.round(params.round);
    }
    if (params?.nextToken) {
      search = search.nextToken(params.nextToken);
    }

    const response = await search.do() as TransactionsResponse;
    // Log only metadata instead of full response
    console.log('Search transactions response metadata:', {
      currentRound: response.currentRound,
      nextToken: response.nextToken,
      transactionCount: response.transactions?.length || 0
    });
    return response;
  } catch (error) {
    console.error('Search transactions error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search transactions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export const handleTransactionTools = ResponseProcessor.wrapResourceHandler(async function handleTransactionTools(args: any): Promise<any> {
  const name = args.name;
  
  switch (name) {
    case 'api_indexer_lookup_transaction_by_id': {
      const { txId } = args;
      const info = await lookupTransactionByID(txId);
      return info.transaction;
    }
    case 'api_indexer_lookup_account_transactions': {
      const { address, ...params } = args;
      const info = await lookupAccountTransactions(address, params);
      return info.transactions;
    }
    case 'api_indexer_search_for_transactions': {
      const info = await searchForTransactions(args);
      return info.transactions;
    }
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
});
