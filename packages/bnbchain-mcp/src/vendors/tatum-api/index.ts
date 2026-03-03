/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';


import { TatumApiClient } from './api-client.js';
import { ToolExecutionContext } from './types.js';
import { GatewayService, GATEWAY_TOOLS } from './services/gateway.js';
import { DataService, DATA_TOOLS } from './services/data.js';

// Inline environment validation functions
function validateEnvironment(): void {
  const missing = ['UNIVERSAL_CRYPTO_API_KEY'].filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error([
      'Missing required environment variables:',
      ...missing.map(env => `   - ${env}`),
      '',
      'Get your API key at: https://dashboard.tatum.io',
      'Set it using: export UNIVERSAL_CRYPTO_API_KEY="your-api-key"',
      'Or use CLI: npx @tatumio/universal-crypto-mcp --api-key your-api-key'
    ].join('\n'));
    process.exit(1);
  }
}

class TatumMCPServer {
  private readonly server: Server;
  private apiClient?: TatumApiClient;
  private gatewayService?: GatewayService;
  private dataService?: DataService;

  constructor() {
    this.server = new Server(
      {
        name: '@tatumio/universal-crypto-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private buildResponse(responseObj: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(responseObj, null, 2)
        }
      ]
    };
  }

  private async executeGatewayTool(name: string, args: any): Promise<any> {
    // Initialize gateway service if needed
    if (!this.gatewayService) {
      const apiKey = process.env.UNIVERSAL_CRYPTO_API_KEY;
      this.gatewayService = new GatewayService(apiKey);
      await this.gatewayService.initialize();
    }

    switch (name) {
      case 'gateway_get_supported_chains':
        return await this.gatewayService.getSupportedChains();
      
      case 'gateway_get_supported_methods':
        if (!args.chain) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: chain');
        }
        const methodsGatewayUrl = await this.gatewayService.getGatewayUrl(args.chain);
        if (!methodsGatewayUrl) {
          throw new McpError(ErrorCode.InvalidParams, `Gateway URL not found for chain: ${args.chain}`);
        }
        return await this.gatewayService.getAvailableMethods(methodsGatewayUrl);
      
      case 'gateway_execute_rpc':
        if (!args.chain || !args.method) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: chain, method');
        }
        // Use the new intelligent chain request method
        return await this.gatewayService.executeChainRequest({
          chainName: args.chain,
          method: args.method,
          params: args.params || []
        });
      
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown gateway tool: ${name}`);
    }
  }

  private async executeDataTool(name: string, args: any): Promise<any> {
    // Initialize data service if needed
    if (!this.dataService) {
      this.apiClient ??= await this.initializeApiClient();
      this.dataService = new DataService(this.apiClient);
    }

    switch (name) {
      case 'get_metadata':
        if (!args.chain || !args.tokenAddress || !args.tokenIds) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: chain, tokenAddress, tokenIds');
        }
        return await this.dataService.getMetadata(args);
      
      case 'get_wallet_balance_by_time':
        if (!args.chain || !args.addresses) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: chain, addresses');
        }
        return await this.dataService.getWalletBalanceByTime(args);
      
      case 'get_wallet_portfolio':
        if (!args.chain || !args.addresses || !args.tokenTypes) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: chain, addresses, tokenTypes');
        }
        return await this.dataService.getWalletPortfolio(args);
      
      case 'get_owners':
        if (!args.chain || !args.tokenAddress) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: chain, tokenAddress');
        }
        return await this.dataService.getOwners(args);
      
      case 'check_owner':
        if (!args.chain || !args.address || !args.tokenAddress) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: chain, address, tokenAddress');
        }
        return await this.dataService.checkOwner(args);
      
      case 'get_transaction_history':
        if (!args.chain) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: chain');
        }
        return await this.dataService.getTransactionHistory(args);
      
      case 'get_block_by_time':
        if (!args.chain) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: chain');
        }
        return await this.dataService.getBlockByTime(args);
      
      case 'get_tokens':
        if (!args.chain || !args.tokenAddress) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: chain, tokenAddress');
        }
        return await this.dataService.getTokens(args);
      
      case 'check_malicious_address':
        if (!args.address) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: address');
        }
        return await this.dataService.checkMaliciousAddress(args);
      
      case 'get_exchange_rate':
        if (!args.symbol || !args.basePair) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: symbol, basePair');
        }
        return await this.dataService.getExchangeRate(args);
      
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown data tool: ${name}`);
    }
  }



  private formatResponseData(data: any): string | null {
    if (!data) {
      return null;
    }
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Combine gateway and data tools
      const allTools = [
        ...GATEWAY_TOOLS.map(tool => ({
          name: tool.name,
          description: `[gateway] ${tool.description}`,
          inputSchema: tool.inputSchema
        })),
        ...DATA_TOOLS.map(tool => ({
          name: tool.name,
          description: `[data] ${tool.description}`,
          inputSchema: tool.inputSchema
        }))
      ];
      
      return { tools: allTools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;
        
        if (name.startsWith('gateway_')) {
          // Handle gateway tools
          result = await this.executeGatewayTool(name, args);
          return this.buildResponse({
            success: true,
            data: this.formatResponseData(result),
            error: null,
            status: 200,
            endpoint: null
          });
        } else if (DATA_TOOLS.some(tool => tool.name === name)) {
          // Handle data tools
          result = await this.executeDataTool(name, args);
          return this.buildResponse({
            success: !result.error,
            data: this.formatResponseData(result.data),
            error: result.error,
            status: result.status,
            endpoint: null
          });
        } else {
          // Unknown tool
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.buildResponse({
          success: false,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 500
        });
      }
    });
  }

  private async initializeApiClient(): Promise<TatumApiClient> {
    const apiKey = process.env.UNIVERSAL_CRYPTO_API_KEY;
    
    if (!apiKey) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        'UNIVERSAL_CRYPTO_API_KEY environment variable is required'
      );
    }

    const context: ToolExecutionContext = {
      apiKey,
      baseUrl: 'https://api.tatum.io',
      timeout: 30000,
      retryAttempts: 3
    };

    const client = new TatumApiClient(context);
    
    return client;
  }

  public async start(): Promise<void> {
    console.error('Starting Universal Crypto MCP Server...');
    
    const transport = new StdioServerTransport();
    
    const totalToolCount = GATEWAY_TOOLS.length + DATA_TOOLS.length;
    console.error(`Loaded ${totalToolCount} tools (0 regular + ${GATEWAY_TOOLS.length} gateway + ${DATA_TOOLS.length} data)`);
    
    await this.server.connect(transport);
    console.error('Universal Crypto MCP Server ready');
  }
}

async function main(): Promise<void> {
  // Load environment variables first
  dotenv.config();
  
  // Validate environment before starting server
  validateEnvironment();
  
  try {
    const server = new TatumMCPServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}