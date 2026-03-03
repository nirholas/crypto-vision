/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { algodClient } from '../../../algorand-client.js';
import type { 
  PendingTransactionResponse,
  NodeStatusResponse,
  PendingTransactionsResponse
} from 'algosdk/dist/types/client/v2/algod/models/types';
import type { SuggestedParamsWithMinFee } from 'algosdk/dist/types/types/transactions/base';

export const transactionTools = [
  {
    name: 'api_algod_get_pending_transaction',
    description: 'Get pending transaction information',
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
    name: 'api_algod_get_pending_transactions_by_address',
    description: 'Get pending transactions for an address',
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
    name: 'api_algod_get_pending_transactions',
    description: 'Get all pending transactions',
    inputSchema: {
      type: 'object',
      properties: {
        maxTxns: {
          type: 'integer',
          description: 'Maximum number of transactions to return'
        }
      }
    }
  },
  {
    name: 'api_algod_get_transaction_params',
    description: 'Get suggested transaction parameters',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_algod_get_node_status',
    description: 'Get current node status',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'api_algod_get_node_status_after_block',
    description: 'Get node status after a specific round',
    inputSchema: {
      type: 'object',
      properties: {
        round: {
          type: 'integer',
          description: 'Round number'
        }
      },
      required: ['round']
    }
  }
];

export async function getPendingTransaction(txId: string): Promise<PendingTransactionResponse> {
  try {
    console.log(`Fetching pending transaction info for ID ${txId}`);
    const response = await algodClient.pendingTransactionInformation(txId).do() as PendingTransactionResponse;
    console.log('Pending transaction response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Pending transaction fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get pending transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getPendingTransactionsByAddress(address: string): Promise<PendingTransactionsResponse> {
  try {
    console.log(`Fetching pending transactions for address ${address}`);
    const response = await algodClient.pendingTransactionByAddress(address).do() as PendingTransactionsResponse;
    console.log('Pending transactions response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Pending transactions fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get pending transactions by address: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getPendingTransactions(maxTxns?: number): Promise<PendingTransactionsResponse> {
  try {
    console.log('Fetching all pending transactions');
    let search = algodClient.pendingTransactionsInformation();
    if (maxTxns !== undefined) {
      search = search.max(maxTxns);
    }
    const response = await search.do() as PendingTransactionsResponse;
    console.log('Pending transactions response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Pending transactions fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get pending transactions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getTransactionParams(): Promise<SuggestedParamsWithMinFee> {
  try {
    console.log('Fetching transaction parameters');
    const response = await algodClient.getTransactionParams().do();
    console.log('Transaction parameters response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Transaction parameters fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get transaction params: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getNodeStatus(): Promise<NodeStatusResponse> {
  try {
    console.log('Fetching node status');
    const response = await algodClient.status().do() as NodeStatusResponse;
    console.log('Node status response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Node status fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get status: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function getNodeStatusAfterBlock(round: number): Promise<NodeStatusResponse> {
  try {
    console.log(`Fetching node status after round ${round}`);
    const response = await algodClient.statusAfterBlock(round).do() as NodeStatusResponse;
    console.log('Node status response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Node status fetch error:', error);
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get status after block: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleTransactionTools(name: string, args: any): Promise<any> {
  switch (name) {
    case 'api_algod_get_pending_transaction': {
      const { txId } = args;
      const info = await getPendingTransaction(txId);
      return info;
    }
    case 'api_algod_get_pending_transactions_by_address': {
      const { address } = args;
      const info = await getPendingTransactionsByAddress(address);
      return info;
    }
    case 'api_algod_get_pending_transactions': {
      const { maxTxns } = args;
      const info = await getPendingTransactions(maxTxns);
      return info;
    }
    case 'api_algod_get_transaction_params': {
      const params = await getTransactionParams();
      return params;
    }
    case 'api_algod_get_node_status': {
      const nodeStatus = await getNodeStatus();
      return nodeStatus;
    }
    case 'api_algod_get_node_status_after_block': {
      const { round } = args;
      const nodeStatus = await getNodeStatusAfterBlock(round);
      return nodeStatus;
    }
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
}
