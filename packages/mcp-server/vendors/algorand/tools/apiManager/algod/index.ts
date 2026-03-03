/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { accountTools, handleAccountTools } from './account.js';
import { applicationTools, handleApplicationTools } from './application.js';
import { assetTools, handleAssetTools } from './asset.js';
import { transactionTools, handleTransactionTools } from './transaction.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// Combine all algod tools
export const algodTools = [
  ...accountTools,
  ...applicationTools,
  ...assetTools,
  ...transactionTools
];

// Handle all algod API tools
export async function handleAlgodTools(name: string, args: any): Promise<any> {
  // Account tools
  if (name.startsWith('api_algod_get_account_')) {
    return handleAccountTools(name, args);
  }
  
  // Application tools
  if (name.startsWith('api_algod_get_application_')) {
    return handleApplicationTools(name, args);
  }
  
  // Asset tools
  if (name.startsWith('api_algod_get_asset_')) {
    return handleAssetTools(name, args);
  }
  
  // Transaction tools
  if (name.startsWith('api_algod_get_')) {
    return handleTransactionTools(name, args);
  }

  throw new McpError(
    ErrorCode.MethodNotFound,
    `Unknown tool: ${name}`
  );
}
