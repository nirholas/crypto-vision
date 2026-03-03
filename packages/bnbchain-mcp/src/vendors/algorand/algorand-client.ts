/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import algosdk from 'algosdk';
import { env } from './env.js';

// Helper function to build resource URIs using API URLs
const buildAlgodUri = (path: string) => {
  return `${env.algorand_algod_api}${path}`;
};

const buildIndexerUri = (path: string) => {
  return `${env.algorand_indexer_api}${path}`;
};

// Resource URI templates using API URLs
export const API_URIS = {
  // Algod resources
  ACCOUNT_DETAILS: buildAlgodUri('/accounts/{address}'),
  ASSET_HOLDINGS: buildAlgodUri('/accounts/{address}/assets'),
  APPLICATION_STATE: buildAlgodUri('/applications/{app-id}/state'),
  ASSET_INFO: buildAlgodUri('/assets/{asset-id}/info'),
  APPLICATION_INFO: buildAlgodUri('/applications/{app-id}'),
  APPLICATION_BOX: buildAlgodUri('/applications/{app-id}/box/{name}'),
  APPLICATION_BOXES: buildAlgodUri('/applications/{app-id}/boxes'),
  PENDING_TRANSACTION: buildAlgodUri('/transactions/pending/{txid}'),
  PENDING_TRANSACTIONS_BY_ADDRESS: buildAlgodUri('/accounts/{address}/transactions/pending'),
  PENDING_TRANSACTIONS: buildAlgodUri('/transactions/pending'),
  TRANSACTION_PARAMS: buildAlgodUri('/transactions/params'),
  NODE_STATUS: buildAlgodUri('/status'),
  NODE_STATUS_AFTER_BLOCK: buildAlgodUri('/status/wait-for-block-after/{round}'),

  // Indexer resources
  TRANSACTION_HISTORY: buildIndexerUri('/accounts/{address}/transactions'),
  ASSET_DETAILS: buildIndexerUri('/assets/{asset-id}'),
  ASSET_BALANCES: buildIndexerUri('/assets/{asset-id}/balances'),
  ASSET_TRANSACTIONS: buildIndexerUri('/assets/{asset-id}/transactions'),
  ASSET_BALANCES_BY_ID: buildIndexerUri('/assets/{asset-id}/balances/{address}'),
  ASSET_TRANSACTIONS_BY_ID: buildIndexerUri('/assets/{asset-id}/transactions/{txid}'),
  TRANSACTION_DETAILS: buildIndexerUri('/transactions/{txid}'),
  TRANSACTION_SEARCH: buildIndexerUri('/transactions')
};

// Initialize the Algod client with base URL
export const algodClient = new algosdk.Algodv2(
  env.algorand_token || '',
  env.algorand_algod,
  env.algorand_algod_port || ''
);

// Initialize the Indexer client with base URL
export const indexerClient = new algosdk.Indexer(
  env.algorand_token || '',
  env.algorand_indexer,
  env.algorand_indexer_port || ''
);

export { indexerClient as indexer };
