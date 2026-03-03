/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  PingRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  AccountManager,
  UtilityManager,
  TransactionManager,
  AlgodManager,
  transactionTools,
  apiManager,
  handleApiManager,
  arc26Manager,
  KnowledgeManager
} from './tools/index.js';
import { ResourceManager } from './resources/index.js';


class AlgorandMcpServer {
  private server: Server;
  private name: string;

  constructor(name = 'universal-crypto-mcp-server', version = '2.7.5') {
    this.name = name;
    this.server = new Server(
      {
        name,
        version,
        heartbeatInterval: 15000, // 15 seconds heartbeat interval
        requestTimeout: 60000,    // 60 seconds request timeout
      },
      {
        capabilities: {
          resources: {
            schemas: ResourceManager.schemas
          },
          tools: {
            schemas: {
              // Account Management Tools
              ...AccountManager.accountTools.reduce((acc, tool) => ({
                ...acc,
                [tool.name]: tool.inputSchema
              }), {}),
              // Utility Tools
              ...UtilityManager.utilityTools.reduce((acc, tool) => ({
                ...acc,
                [tool.name]: tool.inputSchema
              }), {}),
              // Algod Tools
              ...AlgodManager.algodTools.reduce((acc, tool) => ({
                ...acc,
                [tool.name]: tool.inputSchema
              }), {}),
              // Transaction Tools
              ...transactionTools.reduce((acc, tool) => ({
                ...acc,
                [tool.name]: tool.inputSchema
              }), {}),
              // API Tools
              ...apiManager.reduce((acc, tool) => ({
                ...acc,
                [tool.name]: tool.inputSchema
              }), {}),
              // ARC-26 Tools
              ...arc26Manager.arc26Tools.reduce((acc, tool) => ({
                ...acc,
                [tool.name]: tool.inputSchema
              }), {}),
              // Knowledge Tools
              ...KnowledgeManager.knowledgeTools.reduce((acc, tool) => ({
                ...acc,
                [tool.name]: tool.inputSchema
              }), {})
            }
          },
        },
      }
    );

    this.setupResourceHandlers();
    this.setupToolHandlers();
    this.setupPingHandler();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupResourceHandlers() {
    // Implement resources/list method
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: ResourceManager.resources.map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: 'application/json',
          schema: ResourceManager.schemas[resource.uri]
        }))
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      if (!request.params?.uri) {
        throw new McpError(ErrorCode.InvalidRequest, 'URI parameter is required');
      }
      return await ResourceManager.handleResource(request.params.uri);
    });
  }

  private setupPingHandler() {
    // Handle ping requests
    this.server.setRequestHandler(PingRequestSchema, async (request) => {
      try {
        console.error('[MCP Debug] Received ping request:', request);
        const response = {};
        console.error('[MCP Debug] Sending ping response:', response);
        return response;
      } catch (error) {
        console.error('[MCP Error] Ping handler error:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Account Management Tools
        ...AccountManager.accountTools,
        // Utility Tools
        ...UtilityManager.utilityTools,
        // Algod Tools
        ...AlgodManager.algodTools,
        // Transaction Tools
        ...transactionTools,
        // API Tools
        ...apiManager,
        // ARC-26 Tools
        ...arc26Manager.arc26Tools,
        // Knowledge Tools
        ...KnowledgeManager.knowledgeTools,
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      // Handle account tools
      if (
        name.startsWith('create_account') ||
        name.startsWith('rekey_account') ||
        name.startsWith('mnemonic_') ||
        name.startsWith('mdk_') ||
        name.startsWith('seed_') ||
        name.startsWith('secret_key_')
      ) {
        return AccountManager.handleTool(name, args);
      }

      // Handle utility tools
      if (
        name === 'ping' ||
        name.startsWith('validate_address') ||
        name.startsWith('encode_address') ||
        name.startsWith('decode_address') ||
        name.startsWith('get_application_address') ||
        name.startsWith('bytes_to_bigint') ||
        name.startsWith('bigint_to_bytes') ||
        name.startsWith('encode_uint64') ||
        name.startsWith('decode_uint64') ||
        name.startsWith('verify_bytes') ||
        name.startsWith('sign_bytes') ||
        name.startsWith('encode_obj') ||
        name.startsWith('decode_obj') 

      ) {
        return UtilityManager.handleTool(name, args);
      }

      // Handle algod tools
      if (
        name.startsWith('compile_') ||
        name.startsWith('disassemble_') ||
        name.startsWith('send_raw_') ||
        name.startsWith('simulate_')
      ) {
        return AlgodManager.handleTool(name, args);
      }

      // Handle transaction tools
      if (
        name.startsWith('make_') ||
        name === 'assign_group_id' ||
        name === 'sign_transaction' 

      ) {
        return TransactionManager.handleTool(name, args);
      }

      // Handle API tools
      if (name.startsWith('api_')) {
        return handleApiManager(name, args);
      }

      // Handle ARC-26 tools
      if (name === 'generate_algorand_uri') {
        return arc26Manager.handleTool(name, args);
      }

      // Handle knowledge tools
      if (name.startsWith('get_knowledge_')) {
        return KnowledgeManager.handleTool(name, args);
      }

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`${this.name} running on stdio`);
  }
}
const server = new AlgorandMcpServer();
server.run().catch(console.error);
