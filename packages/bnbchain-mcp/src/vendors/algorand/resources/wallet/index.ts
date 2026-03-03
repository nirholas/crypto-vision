/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { env } from '../../env.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import algosdk from 'algosdk';

// Get account from mnemonic
const getAccountFromMnemonic = () => {
  if (!env.algorand_agent_wallet) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      'No active wallet mnemonic configured'
    );
  }
  return algosdk.mnemonicToSecretKey(env.algorand_agent_wallet);
};

// Resource definitions
const resourceDefinitions = [
  {
    uri: 'algorand://wallet/secretkey',
    name: 'Wallet Secret Key',
    description: 'Secret key of the wallet in hex format',
    schema: {
      type: 'object',
      properties: {
        secretKey: { type: 'string' }
      }
    }
  },
  {
    uri: 'algorand://wallet/publickey',
    name: 'Wallet Public Key',
    description: 'Public key of the wallet in hex format',
    schema: {
      type: 'object',
      properties: {
        publicKey: { type: 'string' }
      }
    }
  },
  {
    uri: 'algorand://wallet/mnemonic',
    name: 'Wallet Mnemonic',
    description: 'Mnemonic phrase of the wallet',
    schema: {
      type: 'object',
      properties: {
        mnemonic: { type: 'string' }
      }
    }
  },
  {
    uri: 'algorand://wallet/address',
    name: 'Wallet Address',
    description: 'Algorand address of the wallet',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' }
      }
    }
  },
  {
    uri: 'algorand://wallet/account',
    name: 'Wallet Account',
    description: 'Algorand account balance and asset holdings',
    schema: {
      type: 'object',
      properties: {
        accounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              address: { type: 'string' },
              amount: { type: 'number' },
              assets: { type: 'array' }
            }
          }
        }
      }
    }
  },
  {
    uri: 'algorand://wallet/assets',
    name: 'Wallet Account Assets',
    description: 'Asset holdings for Wallet account',
    schema: {
      type: 'object',
      properties: {
        assets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              amount: { type: 'number' },
              frozen: { type: 'boolean' }
            }
          }
        }
      }
    }
  }
];

// Resource module implementation
export const walletResources = {
  canHandle: (uri: string): boolean => {
    return uri.startsWith('algorand://wallet/');
  },

  handle: async (uri: string) => {
    if (!env.algorand_agent_wallet) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'Wallet resources are not available - no active wallet configured'
      );
    }

    switch (uri) {
      case 'algorand://wallet/account':
        try {
          const account = getAccountFromMnemonic();
          
          // Get account info from algod
          const algodClient = new algosdk.Algodv2(
            env.algorand_token,
            env.algorand_algod,
            env.algorand_algod_port
          );

          const accountInfo = await algodClient.accountInformation(account.addr).do();

          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                accounts: [{
                  address: account.addr,
                  amount: accountInfo.amount,
                  assets: accountInfo.assets || []
                }]
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get account info: ${error instanceof Error ? error.message : String(error)}`
          );
        }

      case 'algorand://wallet/assets':
        try {
          const account = getAccountFromMnemonic();
          
          // Get account info from algod
          const algodClient = new algosdk.Algodv2(
            env.algorand_token,
            env.algorand_algod,
            env.algorand_algod_port
          );

          const accountInfo = await algodClient.accountInformation(account.addr).do();

          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                assets: accountInfo.assets || []
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get asset info: ${error instanceof Error ? error.message : String(error)}`
          );
        }

      case 'algorand://wallet/secretkey':
        try {
          const account = getAccountFromMnemonic();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                secretKey: Buffer.from(account.sk).toString('hex')
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get secret key: ${error instanceof Error ? error.message : String(error)}`
          );
        }

      case 'algorand://wallet/publickey':
        try {
          const account = getAccountFromMnemonic();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                publicKey: Buffer.from(account.sk.slice(32)).toString('hex')
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get public key: ${error instanceof Error ? error.message : String(error)}`
          );
        }

      case 'algorand://wallet/mnemonic':
        try {
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                mnemonic: env.algorand_agent_wallet
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get mnemonic: ${error instanceof Error ? error.message : String(error)}`
          );
        }

      case 'algorand://wallet/address':
        try {
          const account = getAccountFromMnemonic();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                address: account.addr
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to get address: ${error instanceof Error ? error.message : String(error)}`
          );
        }

      default:
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown wallet resource: ${uri}`
        );
    }
  },

  getResourceDefinitions: () => {
    if (!env.algorand_agent_wallet) {
      return [];
    }
    return resourceDefinitions;
  }
};
