/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import algosdk, { Transaction } from 'algosdk';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { algodClient } from '../algorand-client.js';

// Tool schemas
export const accountToolSchemas = {
  createAccount: {
    type: 'object',
    properties: {},
    required: []
  },
  rekeyAccount: {
    type: 'object',
    properties: {
      sourceAddress: { type: 'string', description: 'Sender address in standard Algorand format (58 characters)' },
      targetAddress: { type: 'string', description: 'Address to rekey the sender account to' }
    },
    required: ['sourceAddress', 'targetAddress']
  },
  mnemonicToMdk: {
    type: 'object',
    properties: {
      mnemonic: { type: 'string', description: 'The mnemonic phrase to convert to a master derivation key' }
    },
    required: ['mnemonic']
  },
  mdkToMnemonic: {
    type: 'object',
    properties: {
      mdk: { type: 'string', description: 'The master derivation key in hexadecimal format' }
    },
    required: ['mdk']
  },
  secretKeyToMnemonic: {
    type: 'object',
    properties: {
      secretKey: { type: 'string', description: 'The secret key in hexadecimal format' }
    },
    required: ['secretKey']
  },
  mnemonicToSecretKey: {
    type: 'object',
    properties: {
      mnemonic: { type: 'string', description: 'The mnemonic phrase to convert to a secret key' }
    },
    required: ['mnemonic']
  },
  seedFromMnemonic: {
    type: 'object',
    properties: {
      mnemonic: { type: 'string', description: 'The mnemonic phrase to generate a seed from' }
    },
    required: ['mnemonic']
  },
  mnemonicFromSeed: {
    type: 'object',
    properties: {
      seed: { type: 'string', description: 'The seed in hexadecimal format to generate a mnemonic from' }
    },
    required: ['seed']
  }
};

export class AccountManager {
  static readonly accountTools = [
    {
      name: 'create_account',
      description: 'Create a new Algorand account',
      inputSchema: accountToolSchemas.createAccount,
    },
    {
      name: 'rekey_account',
      description: 'Rekey an Algorand account to a new address',
      inputSchema: accountToolSchemas.rekeyAccount,
    },
    {
      name: 'mnemonic_to_mdk',
      description: 'Convert a mnemonic to a master derivation key',
      inputSchema: accountToolSchemas.mnemonicToMdk,
    },
    {
      name: 'mdk_to_mnemonic',
      description: 'Convert a master derivation key to a mnemonic',
      inputSchema: accountToolSchemas.mdkToMnemonic,
    },
    {
      name: 'secret_key_to_mnemonic',
      description: 'Convert a secret key to a mnemonic',
      inputSchema: accountToolSchemas.secretKeyToMnemonic,
    },
    {
      name: 'mnemonic_to_secret_key',
      description: 'Convert a mnemonic to a secret key',
      inputSchema: accountToolSchemas.mnemonicToSecretKey,
    },
    {
      name: 'seed_from_mnemonic',
      description: 'Generate a seed from a mnemonic',
      inputSchema: accountToolSchemas.seedFromMnemonic,
    },
    {
      name: 'mnemonic_from_seed',
      description: 'Generate a mnemonic from a seed',
      inputSchema: accountToolSchemas.mnemonicFromSeed,
    }
  ];

  // Tool handlers
  static async handleTool(name: string, args: Record<string, unknown>) {
    try {
      switch (name) {
      case 'create_account':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(AccountManager.createAccount(), null, 2),
          }],
        };

      case 'rekey_account':
        if (!args.sourceAddress || !args.targetAddress || 
            typeof args.sourceAddress !== 'string' ||
            typeof args.targetAddress !== 'string') {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid rekey account parameters'
          );
        }
        const rekeyTxn = await AccountManager.createRekeyTransaction(
          args.sourceAddress,
          args.targetAddress
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(rekeyTxn, null, 2),
          }],
        };

      case 'mnemonic_to_mdk':
        if (!args.mnemonic || typeof args.mnemonic !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Mnemonic is required');
        }
        const mdk = AccountManager.mnemonicToMasterDerivationKey(args.mnemonic);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ mdk: Buffer.from(mdk).toString('hex') }, null, 2),
          }],
        };

      case 'mdk_to_mnemonic':
        if (!args.mdk || typeof args.mdk !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Master derivation key is required');
        }
        const mdkMnemonic = AccountManager.masterDerivationKeyToMnemonic(Buffer.from(args.mdk, 'hex'));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ mnemonic: mdkMnemonic }, null, 2),
          }],
        };

      case 'secret_key_to_mnemonic':
        if (!args.secretKey || typeof args.secretKey !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Secret key is required');
        }
        const skMnemonic = AccountManager.secretKeyToMnemonic(Buffer.from(args.secretKey, 'hex'));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ mnemonic: skMnemonic }, null, 2),
          }],
        };

      case 'mnemonic_to_secret_key':
        if (!args.mnemonic || typeof args.mnemonic !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Mnemonic is required');
        }
        const sk = AccountManager.mnemonicToSecretKey(args.mnemonic);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              secretKey: Buffer.from(sk.sk).toString('hex'),
              address: sk.addr
            }, null, 2),
          }],
        };

      case 'seed_from_mnemonic':
        if (!args.mnemonic || typeof args.mnemonic !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Mnemonic is required');
        }
        const seed = AccountManager.seedFromMnemonic(args.mnemonic);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ seed: Buffer.from(seed).toString('hex') }, null, 2),
          }],
        };

      case 'mnemonic_from_seed':
        if (!args.seed || typeof args.seed !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Seed is required');
        }
        const seedMnemonic = AccountManager.mnemonicFromSeed(Buffer.from(args.seed, 'hex'));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ mnemonic: seedMnemonic }, null, 2),
          }],
        };

      default:
        console.error(`[MCP Error] Unknown tool requested: ${name}`);
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
    } catch (error) {
      if (error instanceof McpError) {
        console.error(`[MCP Error] ${error.code}: ${error.message}`);
        throw error;
      }
      console.error('[MCP Error] Unexpected error:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Creates a new account
   * @returns Object containing the address and mnemonic
   */
  static createAccount(): { address: string; mnemonic: string } {
    try {
      const account = algosdk.generateAccount();
      const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
      return {
        address: account.addr,
        mnemonic,
      };
    } catch (error) {
      console.error('[MCP Error] Failed to create account:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create account: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Rekeys an account to a new address
   * @param fromAddress The address to rekey from
   * @param toAddress The address to rekey to
   * @returns The rekey transaction object
   */
  static async createRekeyTransaction(fromAddress: string, toAddress: string): Promise<algosdk.Transaction> {
    try {
      const params = await algodClient.getTransactionParams().do();
      const suggestedParams = { ...params, flatFee: true, fee: params.minFee };

      return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: fromAddress,
        to: fromAddress,
        amount: 0,
        rekeyTo: toAddress,
        suggestedParams,
      });
    } catch (error) {
      console.error('[MCP Error] Failed to create rekey transaction:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create rekey transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converts a mnemonic to a master derivation key
   * @param mnemonic The mnemonic to convert
   * @returns The master derivation key
   */
  static mnemonicToMasterDerivationKey(mnemonic: string): Uint8Array {
    try {
      return algosdk.mnemonicToMasterDerivationKey(mnemonic);
    } catch (error) {
      console.error('[MCP Error] Failed to convert mnemonic to MDK:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid mnemonic provided: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converts a master derivation key to a mnemonic
   * @param mdk The master derivation key to convert
   * @returns The mnemonic
   */
  static masterDerivationKeyToMnemonic(mdk: Uint8Array): string {
    try {
      return algosdk.masterDerivationKeyToMnemonic(mdk);
    } catch (error) {
      console.error('[MCP Error] Failed to convert MDK to mnemonic:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid master derivation key provided: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converts a secret key to a mnemonic
   * @param secretKey The secret key to convert
   * @returns The mnemonic
   */
  static secretKeyToMnemonic(secretKey: Uint8Array): string {
    try {
      return algosdk.secretKeyToMnemonic(secretKey);
    } catch (error) {
      console.error('[MCP Error] Failed to convert secret key to mnemonic:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid secret key provided: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converts a mnemonic to a secret key
   * @param mnemonic The mnemonic to convert
   * @returns The secret key
   */
  static mnemonicToSecretKey(mnemonic: string): { sk: Uint8Array; addr: string } {
    try {
      return algosdk.mnemonicToSecretKey(mnemonic);
    } catch (error) {
      console.error('[MCP Error] Failed to convert mnemonic to secret key:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid mnemonic provided: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates a seed from a mnemonic
   * @param mnemonic The mnemonic to generate the seed from
   * @returns The seed
   */
  static seedFromMnemonic(mnemonic: string): Uint8Array {
    try {
      return algosdk.seedFromMnemonic(mnemonic);
    } catch (error) {
      console.error('[MCP Error] Failed to generate seed from mnemonic:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid mnemonic provided: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generates a mnemonic from a seed
   * @param seed The seed to generate the mnemonic from
   * @returns The mnemonic
   */
  static mnemonicFromSeed(seed: Uint8Array): string {
    try {
      return algosdk.mnemonicFromSeed(seed);
    } catch (error) {
      console.error('[MCP Error] Failed to generate mnemonic from seed:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid seed provided: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
