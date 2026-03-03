/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Transaction, makeApplicationCreateTxnFromObject, OnApplicationComplete } from 'algosdk';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppCreateTxnParams } from './types.js';

/**
 * Creates an application creation transaction
 * @param params The parameters for creating the application
 * @returns The created transaction
 * @throws {McpError} If the transaction creation fails
 */
export function makeApplicationCreateTxn(params: AppCreateTxnParams): Transaction {
  try {
    // Validate schema parameters
    if (typeof params.numGlobalInts !== 'number' || params.numGlobalInts < 0) {
      throw new Error('Invalid numGlobalInts');
    }
    if (typeof params.numGlobalByteSlices !== 'number' || params.numGlobalByteSlices < 0) {
      throw new Error('Invalid numGlobalByteSlices');
    }
    if (typeof params.numLocalInts !== 'number' || params.numLocalInts < 0) {
      throw new Error('Invalid numLocalInts');
    }
    if (typeof params.numLocalByteSlices !== 'number' || params.numLocalByteSlices < 0) {
      throw new Error('Invalid numLocalByteSlices');
    }

    // Create a new object with the required structure
    const txnParams = {
      from: params.from,
      approvalProgram: params.approvalProgram,
      clearProgram: params.clearProgram,
      suggestedParams: params.suggestedParams,
      note: params.note,
      lease: params.lease,
      rekeyTo: params.rekeyTo,
      appArgs: params.appArgs,
      accounts: params.accounts,
      foreignApps: params.foreignApps,
      foreignAssets: params.foreignAssets,
      boxes: params.boxes,
      extraPages: params.extraPages,
      onComplete: OnApplicationComplete.NoOpOC,
      // Schema parameters
      numGlobalInts: params.numGlobalInts,
      numGlobalByteSlices: params.numGlobalByteSlices,
      numLocalInts: params.numLocalInts,
      numLocalByteSlices: params.numLocalByteSlices
    };

    return makeApplicationCreateTxnFromObject(txnParams);
  } catch (error) {
    console.error('[MCP Error] Failed to create application transaction:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to create application transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Handles the application creation tool request
 * @param args The tool arguments
 * @param suggestedParams The suggested transaction parameters
 * @returns The transaction parameters
 * @throws {McpError} If the parameters are invalid
 */
export function handleCreateTxn(args: Record<string, unknown>, suggestedParams: any): Record<string, any> {
  try {
    if (!args.from || !args.approvalProgram || !args.clearProgram ||
        typeof args.numGlobalInts !== 'number' || typeof args.numGlobalByteSlices !== 'number' ||
        typeof args.numLocalInts !== 'number' || typeof args.numLocalByteSlices !== 'number') {
      console.error('[MCP Error] Invalid application creation parameters');
      throw new McpError(ErrorCode.InvalidParams, 'Invalid application creation parameters');
    }

    // Create transaction with proper parameter handling
    const txnParams: Record<string, any> = {
      from: String(args.from),
      fee: suggestedParams.fee,
      firstRound: suggestedParams.firstRound,
      lastRound: suggestedParams.lastRound,
      genesisID: suggestedParams.genesisID,
      genesisHash: suggestedParams.genesisHash,
      type: 'appl',
      onComplete: OnApplicationComplete.NoOpOC,
      // Schema parameters
      numGlobalInts: Number(args.numGlobalInts),
      numGlobalByteSlices: Number(args.numGlobalByteSlices),
      numLocalInts: Number(args.numLocalInts),
      numLocalByteSlices: Number(args.numLocalByteSlices)
    };

    // Handle required program fields - keep as base64 strings
    txnParams.approvalProgram = args.approvalProgram as string;
    txnParams.clearProgram = args.clearProgram as string;

    // Handle optional fields
    if (typeof args.extraPages === 'number') {
      txnParams.extraPages = args.extraPages;
    }
    
    if (typeof args.note === 'string') {
      const noteBytes = new TextEncoder().encode(args.note);
      txnParams.note = Buffer.from(noteBytes).toString('base64');
    }
    if (typeof args.lease === 'string') {
      const leaseBytes = new TextEncoder().encode(args.lease);
      txnParams.lease = Buffer.from(leaseBytes).toString('base64');
    }
    if (typeof args.rekeyTo === 'string') {
      txnParams.rekeyTo = String(args.rekeyTo);
    }
    if (Array.isArray(args.appArgs)) {
      txnParams.appArgs = args.appArgs.map(arg => {
        const bytes = new TextEncoder().encode(String(arg));
        return Buffer.from(bytes).toString('base64');
      });
    }
    if (Array.isArray(args.accounts)) {
      txnParams.accounts = args.accounts.filter((acc): acc is string => typeof acc === 'string');
    }
    if (Array.isArray(args.foreignApps)) {
      txnParams.foreignApps = args.foreignApps.filter((app): app is number => typeof app === 'number');
    }
    if (Array.isArray(args.foreignAssets)) {
      txnParams.foreignAssets = args.foreignAssets.filter((asset): asset is number => typeof asset === 'number');
    }

    return txnParams;
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    console.error('[MCP Error] Failed to handle application creation:', error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to handle application creation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
