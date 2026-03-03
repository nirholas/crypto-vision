/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { Transaction } from 'algosdk';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { algodClient } from '../../../algorand-client.js';
import { appTransactionSchemas, appTransactionTools } from './types.js';
import { makeApplicationCreateTxn, handleCreateTxn } from './createTxn.js';
import { makeApplicationUpdateTxn, handleUpdateTxn } from './updateTxn.js';
import { makeApplicationDeleteTxn, handleDeleteTxn } from './deleteTxn.js';
import { makeApplicationOptInTxn, handleOptInTxn } from './optInTxn.js';
import { makeApplicationCloseOutTxn, handleCloseOutTxn } from './closeOutTxn.js';
import { makeApplicationClearStateTxn, handleClearTxn } from './clearTxn.js';
import { makeApplicationCallTxn, handleCallTxn } from './callTxn.js';

// Export all transaction creation functions
export {
  makeApplicationCreateTxn,
  makeApplicationUpdateTxn,
  makeApplicationDeleteTxn,
  makeApplicationOptInTxn,
  makeApplicationCloseOutTxn,
  makeApplicationClearStateTxn,
  makeApplicationCallTxn
};

// Export all transaction handlers
export {
  handleCreateTxn,
  handleUpdateTxn,
  handleDeleteTxn,
  handleOptInTxn,
  handleCloseOutTxn,
  handleClearTxn,
  handleCallTxn
};

// Export schemas and tool definitions
export { appTransactionSchemas, appTransactionTools };

// Export types
export * from './types.js';

// Map of tool names to their handlers
const toolHandlers: Record<string, (args: Record<string, unknown>, suggestedParams: any) => Record<string, any>> = {
  'make_app_create_txn': handleCreateTxn,
  'make_app_update_txn': handleUpdateTxn,
  'make_app_delete_txn': handleDeleteTxn,
  'make_app_optin_txn': handleOptInTxn,
  'make_app_closeout_txn': handleCloseOutTxn,
  'make_app_clear_txn': handleClearTxn,
  'make_app_call_txn': handleCallTxn
};

export class AppTransactionManager {
  /**
   * Handle application transaction tools
   */
  static async handleTool(name: string, args: Record<string, unknown>) {
    const params = await algodClient.getTransactionParams().do();
    const suggestedParams = { ...params, flatFee: true, fee: params.minFee };

    const handler = toolHandlers[name];
    if (!handler) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown application transaction tool: ${name}`
      );
    }

    try {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(handler(args, suggestedParams), null, 2),
        }],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to handle application transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
