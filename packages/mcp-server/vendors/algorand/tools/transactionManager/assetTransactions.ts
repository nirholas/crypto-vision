/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { 
  Transaction,
  makeAssetCreateTxnWithSuggestedParamsFromObject,
  makeAssetConfigTxnWithSuggestedParamsFromObject,
  makeAssetDestroyTxnWithSuggestedParamsFromObject,
  makeAssetFreezeTxnWithSuggestedParamsFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  SuggestedParams
} from 'algosdk';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { algodClient } from '../../algorand-client.js';

// Tool schemas
export const assetTransactionSchemas = {
  makeAssetCreateTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      total: { type: 'integer', description: 'Total number of base units of the asset to create' },
      decimals: { type: 'integer', description: 'Number of decimals for display purposes (0-19)' },
      defaultFrozen: { type: 'boolean', description: 'Whether accounts should be frozen by default' },
      unitName: { type: 'string', optional: true, description: 'Short name for the asset (1-8 characters)' },
      assetName: { type: 'string', optional: true, description: 'Full name of the asset (1-32 characters)' },
      assetURL: { type: 'string', optional: true, description: 'URL where more information about the asset can be found' },
      assetMetadataHash: { type: 'string', optional: true, description: 'Hash commitment of some sort of asset metadata (32-byte string)' },
      manager: { type: 'string', optional: true, description: 'Address that can manage the asset configuration' },
      reserve: { type: 'string', optional: true, description: 'Address holding reserve funds for the asset' },
      freeze: { type: 'string', optional: true, description: 'Address that can freeze/unfreeze holder accounts' },
      clawback: { type: 'string', optional: true, description: 'Address that can revoke the asset from holders' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' }
    },
    required: ['from', 'total', 'decimals', 'defaultFrozen']
  },
  makeAssetConfigTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      assetIndex: { type: 'integer', description: 'Index of the asset to reconfigure' },
      manager: { type: 'string', optional: true, description: 'New address that can manage the asset configuration' },
      reserve: { type: 'string', optional: true, description: 'New address holding reserve funds for the asset' },
      freeze: { type: 'string', optional: true, description: 'New address that can freeze/unfreeze holder accounts' },
      clawback: { type: 'string', optional: true, description: 'New address that can revoke the asset from holders' },
      strictEmptyAddressChecking: { type: 'boolean', description: 'Whether to error if any provided address is empty' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' }
    },
    required: ['from', 'assetIndex', 'strictEmptyAddressChecking']
  },
  makeAssetDestroyTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      assetIndex: { type: 'integer', description: 'Index of the asset to destroy' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' }
    },
    required: ['from', 'assetIndex']
  },
  makeAssetFreezeTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      assetIndex: { type: 'integer', description: 'Index of the asset being frozen' },
      freezeTarget: { type: 'string', description: 'Address of the account whose asset is being frozen/unfrozen' },
      freezeState: { type: 'boolean', description: 'True to freeze the asset, false to unfreeze' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' }
    },
    required: ['from', 'assetIndex', 'freezeTarget', 'freezeState']
  },
  makeAssetTransferTxn: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      to: { type: 'string', description: 'Recipient address in standard Algorand format (58 characters)' },
      assetIndex: { type: 'integer', description: 'Index of the asset being transferred' },
      amount: { type: 'integer', description: 'Amount of asset base units to transfer' },
      note: { type: 'string', optional: true, description: 'Transaction note field (up to 1000 bytes)' },
      closeRemainderTo: { type: 'string', optional: true, description: 'Address to send remaining asset balance to (close asset holding)' },
      rekeyTo: { type: 'string', optional: true, description: 'Address to rekey the sender account to' }
    },
    required: ['from', 'to', 'assetIndex', 'amount']
  }
};

// Tool definitions
export const assetTransactionTools = [
  {
    name: 'make_asset_create_txn',
    description: 'Create an asset creation transaction',
    inputSchema: assetTransactionSchemas.makeAssetCreateTxn,
  },
  {
    name: 'make_asset_config_txn',
    description: 'Create an asset configuration transaction',
    inputSchema: assetTransactionSchemas.makeAssetConfigTxn,
  },
  {
    name: 'make_asset_destroy_txn',
    description: 'Create an asset destroy transaction',
    inputSchema: assetTransactionSchemas.makeAssetDestroyTxn,
  },
  {
    name: 'make_asset_freeze_txn',
    description: 'Create an asset freeze transaction',
    inputSchema: assetTransactionSchemas.makeAssetFreezeTxn,
  },
  {
    name: 'make_asset_transfer_txn',
    description: 'Create an asset transfer transaction',
    inputSchema: assetTransactionSchemas.makeAssetTransferTxn,
  }
];

export class AssetTransactionManager {
  /**
   * Creates an asset creation transaction
   */
  static makeAssetCreateTxn(params: {
    from: string;
    note?: Uint8Array;
    rekeyTo?: string;
    suggestedParams: SuggestedParams;
    total: number | bigint;
    decimals: number;
    defaultFrozen: boolean;
    unitName?: string;
    assetName?: string;
    assetURL?: string;
    assetMetadataHash?: string | Uint8Array;
    manager?: string;
    reserve?: string;
    freeze?: string;
    clawback?: string;
  }): Transaction {
    return makeAssetCreateTxnWithSuggestedParamsFromObject(params);
  }

  /**
   * Creates an asset configuration transaction
   */
  static makeAssetConfigTxn(params: {
    from: string;
    note?: Uint8Array;
    rekeyTo?: string;
    suggestedParams: SuggestedParams;
    assetIndex: number;
    manager?: string;
    reserve?: string;
    freeze?: string;
    clawback?: string;
    strictEmptyAddressChecking: boolean;
  }): Transaction {
    return makeAssetConfigTxnWithSuggestedParamsFromObject(params);
  }

  /**
   * Creates an asset destroy transaction
   */
  static makeAssetDestroyTxn(params: {
    from: string;
    note?: Uint8Array;
    rekeyTo?: string;
    suggestedParams: SuggestedParams;
    assetIndex: number;
  }): Transaction {
    return makeAssetDestroyTxnWithSuggestedParamsFromObject(params);
  }

  /**
   * Creates an asset freeze transaction
   */
  static makeAssetFreezeTxn(params: {
    from: string;
    note?: Uint8Array;
    rekeyTo?: string;
    suggestedParams: SuggestedParams;
    assetIndex: number;
    freezeTarget: string;
    freezeState: boolean;
  }): Transaction {
    return makeAssetFreezeTxnWithSuggestedParamsFromObject(params);
  }

  /**
   * Creates an asset transfer transaction
   */
  static makeAssetTransferTxn(params: {
    from: string;
    to: string;
    closeRemainderTo?: string;
    revocationTarget?: string;
    amount: number | bigint;
    note?: Uint8Array;
    rekeyTo?: string;
    suggestedParams: SuggestedParams;
    assetIndex: number;
  }): Transaction {
    return makeAssetTransferTxnWithSuggestedParamsFromObject(params);
  }

  // Tool handlers
  static async handleTool(name: string, args: Record<string, unknown>) {
    const params = await algodClient.getTransactionParams().do();
    const suggestedParams = { ...params, flatFee: true, fee: params.minFee  };

    switch (name) {
      case 'make_asset_create_txn':
        if (!args.from || typeof args.total !== 'number' || typeof args.decimals !== 'number' ||
            typeof args.defaultFrozen !== 'boolean') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid asset creation parameters');
        }
        // Create transaction with proper parameter handling
        const createTxnParams: Record<string, any> = {
          from: String(args.from),
          total: Number(args.total),
          decimals: Number(args.decimals),
          defaultFrozen: Boolean(args.defaultFrozen),
          fee: suggestedParams.fee,
          firstRound: suggestedParams.firstRound,
          lastRound: suggestedParams.lastRound,
          genesisID: suggestedParams.genesisID,
          genesisHash: suggestedParams.genesisHash,
          type: 'acfg'
        };

        // Handle optional fields
        if (typeof args.unitName === 'string') {
          createTxnParams.unitName = args.unitName;
        }
        if (typeof args.assetName === 'string') {
          createTxnParams.assetName = args.assetName;
        }
        if (typeof args.assetURL === 'string') {
          createTxnParams.assetURL = args.assetURL;
        }
        if (typeof args.assetMetadataHash === 'string') {
          const metadataBytes = new TextEncoder().encode(args.assetMetadataHash);
          createTxnParams.assetMetadataHash = Buffer.from(metadataBytes).toString('base64');
        }
        if (typeof args.manager === 'string') {
          createTxnParams.manager = args.manager;
        }
        if (typeof args.reserve === 'string') {
          createTxnParams.reserve = args.reserve;
        }
        if (typeof args.freeze === 'string') {
          createTxnParams.freeze = args.freeze;
        }
        if (typeof args.clawback === 'string') {
          createTxnParams.clawback = args.clawback;
        }
        if (typeof args.note === 'string') {
          const noteBytes = new TextEncoder().encode(args.note);
          createTxnParams.note = Buffer.from(noteBytes).toString('base64');
        }
        if (typeof args.rekeyTo === 'string') {
          createTxnParams.rekeyTo = args.rekeyTo;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(createTxnParams, null, 2),
          }],
        };

      case 'make_asset_config_txn':
        if (!args.from || typeof args.assetIndex !== 'number' || typeof args.strictEmptyAddressChecking !== 'boolean') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid asset configuration parameters');
        }
        // Create transaction with proper parameter handling
        const configTxnParams: Record<string, any> = {
          from: String(args.from),
          assetIndex: Number(args.assetIndex),
          fee: suggestedParams.fee,
          firstRound: suggestedParams.firstRound,
          lastRound: suggestedParams.lastRound,
          genesisID: suggestedParams.genesisID,
          genesisHash: suggestedParams.genesisHash,
          type: 'acfg',
          strictEmptyAddressChecking: Boolean(args.strictEmptyAddressChecking)
        };

        // Handle optional fields
        if (typeof args.manager === 'string') {
          configTxnParams.manager = args.manager;
        }
        if (typeof args.reserve === 'string') {
          configTxnParams.reserve = args.reserve;
        }
        if (typeof args.freeze === 'string') {
          configTxnParams.freeze = args.freeze;
        }
        if (typeof args.clawback === 'string') {
          configTxnParams.clawback = args.clawback;
        }
        if (typeof args.note === 'string') {
          const noteBytes = new TextEncoder().encode(args.note);
          configTxnParams.note = Buffer.from(noteBytes).toString('base64');
        }
        if (typeof args.rekeyTo === 'string') {
          configTxnParams.rekeyTo = args.rekeyTo;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(configTxnParams, null, 2),
          }],
        };

      case 'make_asset_destroy_txn':
        if (!args.from || typeof args.assetIndex !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid asset destroy parameters');
        }
        // Create transaction with proper parameter handling
        const destroyTxnParams: Record<string, any> = {
          from: String(args.from),
          assetIndex: Number(args.assetIndex),
          fee: suggestedParams.fee,
          firstRound: suggestedParams.firstRound,
          lastRound: suggestedParams.lastRound,
          genesisID: suggestedParams.genesisID,
          genesisHash: suggestedParams.genesisHash,
          type: 'acfg'
        };

        // Handle optional fields
        if (typeof args.note === 'string') {
          const noteBytes = new TextEncoder().encode(args.note);
          destroyTxnParams.note = Buffer.from(noteBytes).toString('base64');
        }
        if (typeof args.rekeyTo === 'string') {
          destroyTxnParams.rekeyTo = args.rekeyTo;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(destroyTxnParams, null, 2),
          }],
        };

      case 'make_asset_freeze_txn':
        if (!args.from || typeof args.assetIndex !== 'number' || !args.freezeTarget ||
            typeof args.freezeState !== 'boolean') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid asset freeze parameters');
        }
        // Create transaction with proper parameter handling
        const freezeTxnParams: Record<string, any> = {
          from: String(args.from),
          assetIndex: Number(args.assetIndex),
          freezeTarget: String(args.freezeTarget),
          freezeState: Boolean(args.freezeState),
          fee: suggestedParams.fee,
          firstRound: suggestedParams.firstRound,
          lastRound: suggestedParams.lastRound,
          genesisID: suggestedParams.genesisID,
          genesisHash: suggestedParams.genesisHash,
          type: 'afrz'
        };

        // Handle optional fields
        if (typeof args.note === 'string') {
          const noteBytes = new TextEncoder().encode(args.note);
          freezeTxnParams.note = Buffer.from(noteBytes).toString('base64');
        }
        if (typeof args.rekeyTo === 'string') {
          freezeTxnParams.rekeyTo = args.rekeyTo;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(freezeTxnParams, null, 2),
          }],
        };

      case 'make_asset_transfer_txn':
        if (!args.from || !args.to || !args.assetIndex || typeof args.amount !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid asset transfer parameters');
        }
        // Create transaction with proper parameter handling
        const transferTxnParams: Record<string, any> = {
          from: String(args.from),
          to: String(args.to),
          assetIndex: Number(args.assetIndex),
          amount: Number(args.amount),
          fee: suggestedParams.fee,
          firstRound: suggestedParams.firstRound,
          lastRound: suggestedParams.lastRound,
          genesisID: suggestedParams.genesisID,
          genesisHash: suggestedParams.genesisHash,
          type: 'axfer'
        };

        // Handle optional fields
        if (typeof args.note === 'string') {
          const noteBytes = new TextEncoder().encode(args.note);
          transferTxnParams.note = Buffer.from(noteBytes).toString('base64');
        }
        if (typeof args.closeRemainderTo === 'string') {
          transferTxnParams.closeRemainderTo = args.closeRemainderTo;
        }
        if (typeof args.rekeyTo === 'string') {
          transferTxnParams.rekeyTo = args.rekeyTo;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(transferTxnParams, null, 2),
          }],
        };

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown asset transaction tool: ${name}`
        );
    }
  }
}
