/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AccountTransactionManager, accountTransactionTools } from './accountTransactions.js';
import { AssetTransactionManager, assetTransactionTools } from './assetTransactions.js';
import { AppTransactionManager, appTransactionTools } from './appTransactions/index.js';
import { GeneralTransactionManager, generalTransactionTools } from './generalTransaction.js';

// Combine all transaction tools
export const transactionTools = [
  ...accountTransactionTools,
  ...assetTransactionTools,
  ...appTransactionTools,
  ...generalTransactionTools
];

export class TransactionManager {
  // Tool handlers
  static async handleTool(name: string, args: Record<string, unknown>) {
    // Account transactions
    if (name.startsWith('make_payment_') || name.startsWith('make_keyreg_')) {
      return AccountTransactionManager.handleTool(name, args);
    }

    // Asset transactions
    if (name.startsWith('make_asset_')) {
      return AssetTransactionManager.handleTool(name, args);
    }

    // Application transactions
    if (name.startsWith('make_app_')) {
      return AppTransactionManager.handleTool(name, args);
    }

    // General transactions
    if (name === 'assign_group_id' || 
        name === 'sign_transaction' || 
        name === 'sign_bytes' || 
        name === 'encode_obj' || 
        name === 'decode_obj') {
      return GeneralTransactionManager.handleTool(name, args);
    }

    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown transaction tool: ${name}`
    );
  }
}

// Re-export all transaction managers
export {
  AccountTransactionManager,
  AssetTransactionManager,
  AppTransactionManager,
  GeneralTransactionManager
};
