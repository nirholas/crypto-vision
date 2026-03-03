/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { SuggestedParams, OnApplicationComplete } from 'algosdk';
import { on } from 'events';

// Base transaction parameters interface
export interface BaseAppTxnParams {
  from: string;
  suggestedParams: SuggestedParams;
  note?: Uint8Array;
  lease?: Uint8Array;
  rekeyTo?: string;
  appArgs?: Array<Uint8Array>;
  accounts?: string[];
  foreignApps?: number[];
  foreignAssets?: number[];
  boxes?: Array<{ appIndex: number; name: Uint8Array }>;
  onComplete?: OnApplicationComplete;
}

// Application creation parameters
export interface AppCreateTxnParams extends BaseAppTxnParams {
  approvalProgram: Uint8Array;
  clearProgram: Uint8Array;
  numGlobalByteSlices: number;
  numGlobalInts: number;
  numLocalByteSlices: number;
  numLocalInts: number;
  extraPages?: number;
}

// Application update parameters
export interface AppUpdateTxnParams extends BaseAppTxnParams {
  appIndex: number;
  approvalProgram: Uint8Array;
  clearProgram: Uint8Array;
}

// Application delete parameters
export interface AppDeleteTxnParams extends BaseAppTxnParams {
  appIndex: number;
}

// Application opt-in parameters
export interface AppOptInTxnParams extends BaseAppTxnParams {
  appIndex: number;
}

// Application close-out parameters
export interface AppCloseOutTxnParams extends BaseAppTxnParams {
  appIndex: number;
}

// Application clear state parameters
export interface AppClearStateTxnParams extends BaseAppTxnParams {
  appIndex: number;
}

// Application call parameters
export interface AppCallTxnParams extends BaseAppTxnParams {
  appIndex: number;
}

// Tool schemas for MCP
export const appTransactionSchemas = {
  makeAppCreateTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      approvalProgram: { type: 'string', description: 'Logic that executes when the app is called (compiled TEAL as base64)' },
      clearProgram: { type: 'string', description: 'Logic that executes when clear state is called (compiled TEAL as base64)' },
      numGlobalByteSlices: { type: 'integer', description: 'Number of byte array values in global state (0-64)' },
      numGlobalInts: { type: 'integer', description: 'Number of integer values in global state (0-64)' },
      numLocalByteSlices: { type: 'integer', description: 'Number of byte array values in local state per account (0-16)' },
      numLocalInts: { type: 'integer', description: 'Number of integer values in local state per account (0-16)' },
      extraPages: { type: 'integer', optional: true, description: 'Additional program pages for larger programs (0-3)' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      lease: { type: 'string', optional: true, description: 'Lease enforces mutual exclusion of transactions (32 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' },
      appArgs: { 
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Arguments to pass to the application (max 16 arguments)'
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Accounts whose local state may be accessed (max 4 accounts)'
      },
      foreignApps: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of apps whose global state may be accessed (max 8 apps)'
      },
      foreignAssets: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of assets that may be accessed (max 8 assets)'
      }
    },
    required: ['from', 'approvalProgram', 'clearProgram', 'numGlobalByteSlices', 'numGlobalInts', 'numLocalByteSlices', 'numLocalInts']
  },
  makeAppUpdateTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      appIndex: { type: 'integer', description: 'ID of the application to update' },
      approvalProgram: { type: 'string', description: 'New approval program (compiled TEAL as base64)' },
      clearProgram: { type: 'string', description: 'New clear state program (compiled TEAL as base64)' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      lease: { type: 'string', optional: true, description: 'Lease enforces mutual exclusion of transactions (32 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' },
      appArgs: { 
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Arguments to pass to the application (max 16 arguments)'
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Accounts whose local state may be accessed (max 4 accounts)'
      },
      foreignApps: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of apps whose global state may be accessed (max 8 apps)'
      },
      foreignAssets: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of assets that may be accessed (max 8 assets)'
      },
      onComplete: { type: 'integer', optional: true, description: 'Application call completion behavior (0=NoOp, 1=OptIn, 2=CloseOut, 3=ClearState, 4=UpdateApplication, 5=DeleteApplication)' }
    },
    required: ['from', 'appIndex', 'approvalProgram', 'clearProgram']
  },
  makeAppDeleteTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      appIndex: { type: 'integer', description: 'ID of the application to delete' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      lease: { type: 'string', optional: true, description: 'Lease enforces mutual exclusion of transactions (32 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' },
      appArgs: { 
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Arguments to pass to the application (max 16 arguments)'
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Accounts whose local state may be accessed (max 4 accounts)'
      },
      foreignApps: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of apps whose global state may be accessed (max 8 apps)'
      },
      foreignAssets: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of assets that may be accessed (max 8 assets)'
      },
      onComplete: { type: 'integer', optional: true, description: 'Application call completion behavior (0=NoOp, 1=OptIn, 2=CloseOut, 3=ClearState, 4=UpdateApplication, 5=DeleteApplication)' }
    },
    required: ['from', 'appIndex']
  },
  makeAppOptInTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      appIndex: { type: 'integer', description: 'ID of the application to opt into' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      lease: { type: 'string', optional: true, description: 'Lease enforces mutual exclusion of transactions (32 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' },
      appArgs: { 
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Arguments to pass to the application (max 16 arguments)'
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Accounts whose local state may be accessed (max 4 accounts)'
      },
      foreignApps: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of apps whose global state may be accessed (max 8 apps)'
      },
      foreignAssets: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of assets that may be accessed (max 8 assets)'
      },
      onComplete: { type: 'integer', optional: true, description: 'Application call completion behavior (0=NoOp, 1=OptIn, 2=CloseOut, 3=ClearState, 4=UpdateApplication, 5=DeleteApplication)' }
    },
    required: ['from', 'appIndex']
  },
  makeAppCloseOutTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      appIndex: { type: 'integer', description: 'ID of the application to close out from' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      lease: { type: 'string', optional: true, description: 'Lease enforces mutual exclusion of transactions (32 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' },
      appArgs: { 
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Arguments to pass to the application (max 16 arguments)'
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Accounts whose local state may be accessed (max 4 accounts)'
      },
      foreignApps: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of apps whose global state may be accessed (max 8 apps)'
      },
      foreignAssets: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of assets that may be accessed (max 8 assets)'
      },
      onComplete: { type: 'integer', optional: true, description: 'Application call completion behavior (0=NoOp, 1=OptIn, 2=CloseOut, 3=ClearState, 4=UpdateApplication, 5=DeleteApplication)' }
    },
    required: ['from', 'appIndex']
  },
  makeAppClearTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      appIndex: { type: 'integer', description: 'ID of the application to clear state from' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      lease: { type: 'string', optional: true, description: 'Lease enforces mutual exclusion of transactions (32 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' },
      appArgs: { 
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Arguments to pass to the application (max 16 arguments)'
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Accounts whose local state may be accessed (max 4 accounts)'
      },
      foreignApps: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of apps whose global state may be accessed (max 8 apps)'
      },
      foreignAssets: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of assets that may be accessed (max 8 assets)'
      },
      onComplete: { type: 'integer', optional: true, description: 'Application call completion behavior (0=NoOp, 1=OptIn, 2=CloseOut, 3=ClearState, 4=UpdateApplication, 5=DeleteApplication)' }
    },
    required: ['from', 'appIndex']
  },
  makeAppCallTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      appIndex: { type: 'integer', description: 'ID of the application to call' },
      appArgs: { 
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Arguments to pass to the application (max 16 arguments)'
      },
      accounts: {
        type: 'array',
        items: { type: 'string' },
        optional: true,
        description: 'Accounts whose local state may be accessed (max 4 accounts)'
      },
      foreignApps: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of apps whose global state may be accessed (max 8 apps)'
      },
      foreignAssets: {
        type: 'array',
        items: { type: 'integer' },
        optional: true,
        description: 'IDs of assets that may be accessed (max 8 assets)'
      },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' }
    },
    required: ['from', 'appIndex']
  }
};

// Tool definitions
export const appTransactionTools = [
  {
    name: 'make_app_create_txn',
    description: 'Create an application creation transaction',
    inputSchema: appTransactionSchemas.makeAppCreateTxn,
  },
  {
    name: 'make_app_update_txn',
    description: 'Create an application update transaction',
    inputSchema: appTransactionSchemas.makeAppUpdateTxn,
  },
  {
    name: 'make_app_delete_txn',
    description: 'Create an application delete transaction',
    inputSchema: appTransactionSchemas.makeAppDeleteTxn,
  },
  {
    name: 'make_app_optin_txn',
    description: 'Create an application opt-in transaction',
    inputSchema: appTransactionSchemas.makeAppOptInTxn,
  },
  {
    name: 'make_app_closeout_txn',
    description: 'Create an application close out transaction',
    inputSchema: appTransactionSchemas.makeAppCloseOutTxn,
  },
  {
    name: 'make_app_clear_txn',
    description: 'Create an application clear state transaction',
    inputSchema: appTransactionSchemas.makeAppClearTxn,
  },
  {
    name: 'make_app_call_txn',
    description: 'Create an application call transaction',
    inputSchema: appTransactionSchemas.makeAppCallTxn,
  }
];
