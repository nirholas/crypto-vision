/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ResponseProcessor } from '../../../utils/responseProcessor.js';
import { algodClient } from '../../../algorand-client.js';

/**
 * Example tool to demonstrate implementation patterns
 * Gets account balance and assets for a given address
 * 
 * @param {Object} args - Tool arguments
 * @param {string} args.address - Algorand address to check
 * @returns {Promise<Object>} Account balance information including assets
 * @throws {McpError} If address is invalid or operation fails
 */
export const getBalanceToolSchema: { type: "object", properties: any, required: string[] } = {
  type: "object",
  properties: {
    address: {
      type: 'string',
      description: 'Algorand address in standard format (58 characters)'
    }
  },
  required: ['address']
};

export const getBalanceTool = async (args: { address: string }) => {
  try {
    // Input validation
    if (!args.address) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: address'
      );
    }

    if (!/^[A-Z2-7]{58}$/.test(args.address)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid Algorand address format'
      );
    }

    // Get account information using Algorand client
    const accountInfo = await algodClient.accountInformation(args.address).do();

    // Return complete response without pagination
    return accountInfo;
  } catch (error: unknown) {
    // Handle specific Algorand API errors
    if (error instanceof McpError) {
      throw error;
    }

    // Format error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get account balance: ${errorMessage}`
    );
  }
};
