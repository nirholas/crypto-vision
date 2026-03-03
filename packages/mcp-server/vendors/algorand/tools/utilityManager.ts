/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import algosdk from 'algosdk';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import nacl from 'tweetnacl';

// Tool schemas
export const utilityToolSchemas = {
  ping: {
    type: 'object',
    properties: {},
    required: []
  },
  validateAddress: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Address in standard Algorand format (58 characters)' }
    },
    required: ['address']
  },
  encodeAddress: {
    type: 'object',
    properties: {
      publicKey: { type: 'string', description: 'Public key in hexadecimal format to encode into an address' }
    },
    required: ['publicKey']
  },
  decodeAddress: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Address in standard Algorand format (58 characters) to decode' }
    },
    required: ['address']
  },
  getApplicationAddress: {
    type: 'object',
    properties: {
      appId: { type: 'integer', description: 'Application ID to get the address for' }
    },
    required: ['appId']
  },
  bytesToBigint: {
    type: 'object',
    properties: {
      bytes: { type: 'string', description: 'Bytes in hexadecimal format to convert to a BigInt' }
    },
    required: ['bytes']
  },
  bigintToBytes: {
    type: 'object',
    properties: {
      value: { type: 'string', description: 'BigInt value as a string to convert to bytes' },
      size: { type: 'integer', description: 'Size of the resulting byte array' }
    },
    required: ['value', 'size']
  },
  encodeUint64: {
    type: 'object',
    properties: {
      value: { type: 'string', description: 'Uint64 value as a string to encode into bytes' }
    },
    required: ['value']
  },
  decodeUint64: {
    type: 'object',
    properties: {
      bytes: { type: 'string', description: 'Bytes in hexadecimal format to decode into a uint64' }
    },
    required: ['bytes']
  },
  verifyBytes: {
    type: 'object',
    properties: {
      bytes: { type: 'string', description: 'Bytes in hexadecimal format to verify' },
      signature: { type: 'string', description: 'Base64-encoded signature to verify' },
      address: { type: 'string', description: 'Algorand account address' }
    },
    required: ['bytes', 'signature', 'address']
  }
};

export class UtilityManager {
  static readonly utilityTools = [
    {
      name: 'ping',
      description: 'Basic protocol utility to verify server connectivity',
      inputSchema: utilityToolSchemas.ping,
    },
    {
      name: 'validate_address',
      description: 'Check if an Algorand address is valid',
      inputSchema: utilityToolSchemas.validateAddress,
    },
    {
      name: 'encode_address',
      description: 'Encode a public key to an Algorand address',
      inputSchema: utilityToolSchemas.encodeAddress,
    },
    {
      name: 'decode_address',
      description: 'Decode an Algorand address to a public key',
      inputSchema: utilityToolSchemas.decodeAddress,
    },
    {
      name: 'get_application_address',
      description: 'Get the address for a given application ID',
      inputSchema: utilityToolSchemas.getApplicationAddress,
    },
    {
      name: 'bytes_to_bigint',
      description: 'Convert bytes to a BigInt',
      inputSchema: utilityToolSchemas.bytesToBigint,
    },
    {
      name: 'bigint_to_bytes',
      description: 'Convert a BigInt to bytes',
      inputSchema: utilityToolSchemas.bigintToBytes,
    },
    {
      name: 'encode_uint64',
      description: 'Encode a uint64 to bytes',
      inputSchema: utilityToolSchemas.encodeUint64,
    },
    {
      name: 'decode_uint64',
      description: 'Decode bytes to a uint64',
      inputSchema: utilityToolSchemas.decodeUint64,
    },
    {
      name: 'verify_bytes',
      description: 'Verify a signature against bytes with an Algorand address',
      inputSchema: utilityToolSchemas.verifyBytes,
    },
    {
      name: 'sign_bytes',
      description: 'Sign bytes with a secret key',
      inputSchema: {
        type: 'object',
        properties: {
          bytes: { type: 'string', description: 'Bytes in hexadecimal format to sign' },
          sk: { type: 'string', description: 'Secret key in hexadecimal format to sign the bytes with' }
        },
        required: ['bytes', 'sk']
      },
     
    },
    {
      name: 'encode_obj',
      description: 'Encode an object to msgpack format',
      inputSchema: {
        type: 'object',
        properties: {
          obj: { type: 'object', description: 'Object to encode' }
        },
        required: ['obj']
      },
    },
    {
      name: 'decode_obj',
      description: 'Decode msgpack bytes to an object',
      inputSchema: {
        type: 'object',
        properties: {
          bytes: { type: 'string', description: 'Base64-encoded msgpack bytes to decode' }
        },
        required: ['bytes']
      },
    }

  ];

  // Tool handlers
  static async handleTool(name: string, args: Record<string, unknown>) {
    try {
      switch (name) {
      case 'ping':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({}, null, 2),
          }],
        };

      case 'validate_address':
        if (!args.address || typeof args.address !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Address is required');
        }
        const isValid = UtilityManager.isValidAddress(args.address);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ isValid }, null, 2),
          }],
        };

      case 'encode_address':
        if (!args.publicKey || typeof args.publicKey !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Public key is required');
        }
        const encodedAddress = UtilityManager.encodeAddress(Buffer.from(args.publicKey, 'hex'));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ address: encodedAddress }, null, 2),
          }],
        };

      case 'decode_address':
        if (!args.address || typeof args.address !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Address is required');
        }
        const decodedPublicKey = UtilityManager.decodeAddress(args.address);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ publicKey: Buffer.from(decodedPublicKey).toString('hex') }, null, 2),
          }],
        };

      case 'get_application_address':
        if (!args.appId || typeof args.appId !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'Application ID is required');
        }
        const appAddress = UtilityManager.getApplicationAddress(args.appId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ address: appAddress }, null, 2),
          }],
        };

      case 'bytes_to_bigint':
        if (!args.bytes || typeof args.bytes !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Bytes are required');
        }
        const bigInt = UtilityManager.bytesToBigInt(Buffer.from(args.bytes, 'hex'));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ value: bigInt.toString() }, null, 2),
          }],
        };

      case 'bigint_to_bytes':
        if (!args.value || typeof args.value !== 'string' || !args.size || typeof args.size !== 'number') {
          throw new McpError(ErrorCode.InvalidParams, 'Value and size are required');
        }
        const bytes = UtilityManager.bigIntToBytes(BigInt(args.value), args.size);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ bytes: Buffer.from(bytes).toString('hex') }, null, 2),
          }],
        };

      case 'encode_uint64':
        if (!args.value || typeof args.value !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Value is required');
        }
        const encodedUint64 = UtilityManager.encodeUint64(BigInt(args.value));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ bytes: Buffer.from(encodedUint64).toString('hex') }, null, 2),
          }],
        };

      case 'decode_uint64':
        if (!args.bytes || typeof args.bytes !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Bytes are required');
        }
        const decodedUint64 = UtilityManager.decodeUint64(Buffer.from(args.bytes, 'hex'));
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ value: decodedUint64.toString() }, null, 2),
          }],
        };
      case 'sign_bytes': {
        if (!args.bytes || typeof args.bytes !== 'string' || !args.sk || typeof args.sk !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid sign bytes parameters');
        }

        try {
          const bytes = Buffer.from(args.bytes, 'hex');
          const sk = Buffer.from(args.sk, 'hex');
          const sig = algosdk.signBytes(bytes, sk);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                signature: Buffer.from(sig).toString('base64')
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Failed to sign bytes: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      case 'encode_obj': {
        if (!args.obj || typeof args.obj !== 'object') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid encode object parameters');
        }

        try {
          const encoded = algosdk.encodeObj(args.obj);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                encoded: Buffer.from(encoded).toString('base64')
              }, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Failed to encode object: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      case 'decode_obj': {
        if (!args.bytes || typeof args.bytes !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Invalid decode object parameters');
        }

        try {
          const bytes = Buffer.from(args.bytes, 'base64');
          const decoded = algosdk.decodeObj(bytes);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(decoded, null, 2)
            }]
          };
        } catch (error) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Failed to decode object: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      case 'verify_bytes':
        if (!args.bytes || typeof args.bytes !== 'string' || !args.signature || typeof args.signature !== 'string' || !args.address || typeof args.address !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Bytes, signature, and public key are required');
        }
        const verified = UtilityManager.verifyBytes(new Uint8Array(Buffer.from(args.bytes, 'hex')), new Uint8Array(Buffer.from(args.signature, 'base64')), args.address);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ verified }, null, 2),
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
   * Checks if an address is valid
   * @param address The address to validate
   * @returns True if the address is valid, false otherwise
   */
  static isValidAddress(address: string): boolean {
    try {
      return algosdk.isValidAddress(address);
    } catch (error) {
      console.error('[MCP Error] Failed to validate address:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid address format: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Encodes a public key to an Algorand address
   * @param publicKey The public key to encode
   * @returns The encoded address
   */
  static encodeAddress(publicKey: Buffer): string {
    try {
      return algosdk.encodeAddress(new Uint8Array(publicKey));
    } catch (error) {
      console.error('[MCP Error] Failed to encode address:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid public key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decodes an Algorand address to a public key
   * @param address The address to decode
   * @returns The decoded public key
   */
  static decodeAddress(address: string): Uint8Array {
    try {
      return algosdk.decodeAddress(address).publicKey;
    } catch (error) {
      console.error('[MCP Error] Failed to decode address:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid address: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Gets the application address for a given application ID
   * @param appId The application ID
   * @returns The application address
   */
  static getApplicationAddress(appId: number): string {
    try {
      return algosdk.getApplicationAddress(appId);
    } catch (error) {
      console.error('[MCP Error] Failed to get application address:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid application ID: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converts bytes to a BigInt
   * @param bytes The bytes to convert
   * @returns The BigInt value
   */
  static bytesToBigInt(bytes: Uint8Array): bigint {
    try {
      return BigInt('0x' + Buffer.from(bytes).toString('hex'));
    } catch (error) {
      console.error('[MCP Error] Failed to convert bytes to BigInt:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid bytes format: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Converts a BigInt to bytes
   * @param value The BigInt value to convert
   * @param size The size of the resulting byte array
   * @returns The bytes representation
   */
  static bigIntToBytes(value: bigint, size: number): Uint8Array {
    try {
      const hex = value.toString(16).padStart(size * 2, '0');
      return Buffer.from(hex, 'hex');
    } catch (error) {
      console.error('[MCP Error] Failed to convert BigInt to bytes:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid BigInt value or size: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Encodes a uint64 to bytes
   * @param value The uint64 value to encode
   * @returns The encoded bytes
   */
  static encodeUint64(value: bigint): Uint8Array {
    try {
      return this.bigIntToBytes(value, 8);
    } catch (error) {
      console.error('[MCP Error] Failed to encode uint64:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid uint64 value: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decodes bytes to a uint64
   * @param bytes The bytes to decode
   * @returns The decoded uint64 value
   */
  static decodeUint64(bytes: Uint8Array): bigint {
    try {
      return this.bytesToBigInt(bytes);
    } catch (error) {
      console.error('[MCP Error] Failed to decode uint64:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid uint64 bytes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verifies a signature against bytes with a public key
   * @param bytes The bytes that were signed
   * @param signature The signature to verify
   * @param address The Algorand address of the signer
   * @returns True if the signature is valid
   */
  static verifyBytes(bytes: Uint8Array, signature: Uint8Array, address: string): boolean {
    console.log('Verifying bytes:', {
      bytes: Buffer.from(bytes).toString('hex'),
      signature: Buffer.from(signature).toString('base64'),
      address,
    });
    try {
      const mxBytes = new TextEncoder().encode("MX");
      const fullBytes = new Uint8Array(mxBytes.length + bytes.length);
      fullBytes.set(mxBytes);
      fullBytes.set(bytes, mxBytes.length);
      
      // Convert back to hex
        let pk = algosdk.decodeAddress(address).publicKey;
        let verify_nacl = nacl.sign.detached.verify(fullBytes, signature, pk)
        //return algosdk.verifyBytes(bytes, signature, address);
      return verify_nacl
    } catch (error) {
      console.error('[MCP Error] Failed to verify bytes:', error);
      throw new McpError(
        ErrorCode.InvalidParams,
        `Failed to verify: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
