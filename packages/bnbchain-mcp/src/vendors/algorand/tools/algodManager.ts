/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import algosdk, { modelsv2 } from 'algosdk';
import type { EncodedSignedTransaction } from 'algosdk';
import type { 
  SimulateResponse,
  CompileResponse,
  DisassembleResponse,
  SimulateTraceConfig,
  PostTransactionsResponse
} from 'algosdk/dist/types/client/v2/algod/models/types';
import { algodClient } from '../algorand-client.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Tool schemas
export const algodToolSchemas = {
  compileTeal: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Logic that executes when the app is called (compiled TEAL as base64)' }
    },
    required: ['source']
  },
  disassembleTeal: {
    type: 'object',
    properties: {
      bytecode: { type: 'string', description: 'TEAL bytecode to disassemble into source code' }
    },
    required: ['bytecode']
  },
  sendRawTransaction: {
    type: 'object',
    properties: {
      signedTxns: {
        type: 'array',
        items: { type: 'string', description: 'Base64-encoded signed transaction' },
        description: 'Array of signed transactions to submit to the network'
      }
    },
    required: ['signedTxns']
  },
  simulateRawTransactions: {
    type: 'object',
    properties: {
      txns: {
        type: 'array',
        items: { type: 'string', description: 'Base64-encoded transaction' },
        description: 'Array of transactions to simulate'
      }
    },
    required: ['txns']
  },
  simulateTransactions: {
    type: 'object',
    properties: {
      txnGroups: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            txns: {
              type: 'array',
              items: { type: 'object', description: 'Transaction object to simulate' },
              description: 'Array of transactions in this group'
            }
          },
          required: ['txns'],
          description: 'Group of transactions to simulate together'
        },
        description: 'Array of transaction groups to simulate'
      },
      allowEmptySignatures: { type: 'boolean', optional: true, description: 'Allow transactions without signatures' },
      allowMoreLogging: { type: 'boolean', optional: true, description: 'Enable additional logging during simulation' },
      allowUnnamedResources: { type: 'boolean', optional: true, description: 'Allow access to resources not listed in transaction' },
      execTraceConfig: { type: 'object', optional: true, description: 'Configuration for execution trace output' },
      extraOpcodeBudget: { type: 'integer', optional: true, description: 'Additional budget for TEAL program execution' },
      round: { type: 'integer', optional: true, description: 'Round at which to simulate the transactions' }
    },
    required: ['txnGroups']
  }
};

export class AlgodManager {
  static readonly algodTools = [
    {
      name: 'compile_teal',
      description: 'Compile TEAL source code',
      inputSchema: algodToolSchemas.compileTeal,
    },
    {
      name: 'disassemble_teal',
      description: 'Disassemble TEAL bytecode back to source',
      inputSchema: algodToolSchemas.disassembleTeal,
    },
    {
      name: 'send_raw_transaction',
      description: 'Submit signed transactions to the Algorand network',
      inputSchema: algodToolSchemas.sendRawTransaction,
    },
    {
      name: 'simulate_raw_transactions',
      description: 'Simulate raw transactions',
      inputSchema: algodToolSchemas.simulateRawTransactions,
    },
    {
      name: 'simulate_transactions',
      description: 'Simulate transactions with detailed configuration',
      inputSchema: algodToolSchemas.simulateTransactions,
    }
  ];

  // Tool handlers
  static async handleTool(name: string, args: Record<string, unknown>) {
    try {
      switch (name) {
      case 'compile_teal':
        if (!args.source || typeof args.source !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'TEAL source code is required');
        }
        const result = await AlgodManager.compile(args.source);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };

      case 'disassemble_teal':
        if (!args.bytecode || typeof args.bytecode !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'TEAL bytecode is required');
        }
        const disassembled = await AlgodManager.disassemble(args.bytecode);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(disassembled, null, 2),
          }],
        };

      case 'send_raw_transaction':
        if (!args.signedTxns || !Array.isArray(args.signedTxns)) {
          throw new McpError(ErrorCode.InvalidParams, 'Signed transactions array is required');
        }
        const txns = args.signedTxns.map(txn => {
          if (typeof txn !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Each transaction must be a base64 string');
          }
          return Buffer.from(txn, 'base64');
        });
        const sent = await AlgodManager.sendRawTransaction(txns);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(sent, null, 2),
          }],
        };

      case 'simulate_raw_transactions':
        if (!args.txns || !Array.isArray(args.txns)) {
          throw new McpError(ErrorCode.InvalidParams, 'Transactions array is required');
        }
        const rawTxns = args.txns.map(txn => {
          if (typeof txn !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'Each transaction must be a base64 string');
          }
          return Buffer.from(txn, 'base64');
        });
        const simulated = await AlgodManager.simulateRawTransactions(rawTxns);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(simulated, null, 2),
          }],
        };

      case 'simulate_transactions':
        if (!args.txnGroups || !Array.isArray(args.txnGroups)) {
          throw new McpError(ErrorCode.InvalidParams, 'Transaction groups array is required');
        }
        const simulateResult = await AlgodManager.simulateTransactions(args as any);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(simulateResult, null, 2),
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
   * Compiles TEAL source code to binary
   * @param source TEAL source code as string or bytes
   * @returns Compilation result with hash and bytecode
   */
  static async compile(source: string | Uint8Array): Promise<CompileResponse> {
    try {
      // Convert string source to Buffer
      if (typeof source === 'string') {
        // Ensure proper line endings and add final newline
        source = source.replace(/\r\n/g, '\n');
        if (!source.endsWith('\n')) {
          source += '\n';
        }
        source = new TextEncoder().encode(source);
      }
      const response = await algodClient.compile(source).do() as CompileResponse;
      return response;
    } catch (error) {
      console.error('[MCP Error] Failed to compile TEAL:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to compile TEAL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Disassembles TEAL bytecode back to source
   * @param bytecode TEAL bytecode as string or bytes
   * @returns Disassembled TEAL source code
   */
  static async disassemble(bytecode: string | Uint8Array): Promise<DisassembleResponse> {
    try {
      const response = await algodClient.disassemble(bytecode).do() as DisassembleResponse;
      return response;
    } catch (error) {
      console.error('[MCP Error] Failed to disassemble TEAL:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to disassemble TEAL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Broadcasts signed transactions to the network
   * @param signedTxns Single signed transaction or array of signed transactions
   * @returns Transaction ID of the submission
   */
  static async sendRawTransaction(signedTxns: Uint8Array | Uint8Array[]): Promise<PostTransactionsResponse> {
    try {
      const response = await algodClient.sendRawTransaction(signedTxns).do() as PostTransactionsResponse;
      return response;
    } catch (error) {
      console.error('[MCP Error] Failed to send transaction:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Simulates raw transactions
   * @param txns Single transaction or array of transactions to simulate
   * @returns Simulation results
   */
  static async simulateRawTransactions(txns: Uint8Array | Uint8Array[]): Promise<SimulateResponse> {
    try {
      const response = await algodClient.simulateRawTransactions(txns).do() as SimulateResponse;
      return response;
    } catch (error) {
      console.error('[MCP Error] Failed to simulate raw transactions:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to simulate raw transactions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Simulates transactions with detailed configuration
   * @param request Simulation request with transaction groups and configuration
   * @returns Simulation results
   */
  static async simulateTransactions(request: {
    txnGroups: { txns: EncodedSignedTransaction[] }[];
    allowEmptySignatures?: boolean;
    allowMoreLogging?: boolean;
    allowUnnamedResources?: boolean;
    execTraceConfig?: SimulateTraceConfig;
    extraOpcodeBudget?: number;
    round?: number;
  }): Promise<SimulateResponse> {
    try {
      const simulateRequest = new modelsv2.SimulateRequest({
        txnGroups: request.txnGroups.map(group => 
          new modelsv2.SimulateRequestTransactionGroup({ txns: group.txns })
        ),
        allowEmptySignatures: request.allowEmptySignatures,
        allowMoreLogging: request.allowMoreLogging,
        allowUnnamedResources: request.allowUnnamedResources,
        execTraceConfig: request.execTraceConfig,
        extraOpcodeBudget: request.extraOpcodeBudget,
        round: request.round,
      });

      const response = await algodClient.simulateTransactions(simulateRequest).do() as SimulateResponse;
      return response;
    } catch (error) {
      console.error('[MCP Error] Failed to simulate transactions:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to simulate transactions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
