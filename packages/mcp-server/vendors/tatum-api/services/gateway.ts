/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Gateway, GatewayChain, ExternalBlockchain, TatumApiResponse } from '../types.js';
import { chainProtocolMap, getChainProtocol, getChainApiConfig, ChainApiConfig } from '../utils/chains.js';

// Gateway tool definitions - these belong with the gateway service
export const GATEWAY_TOOLS: Tool[] = [
  {
    name: 'gateway_get_supported_chains',
    description: "Get a list of all supported blockchain networks available through Tatum's RPC gateways",
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'gateway_get_supported_methods',
    description: 'Get supported RPC methods for a specific blockchain chain',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: "The blockchain network identifier. Examples: 'bitcoin-mainnet', 'ethereum-mainnet', 'litecoin-mainnet', 'polygon-mainnet', 'tron-mainnet', 'bsc-mainnet', 'solana-mainnet'. Use gateway_get_supported_chains to see all available networks.",
          examples: ['bitcoin-mainnet', 'ethereum-mainnet', 'litecoin-mainnet', 'polygon-mainnet', 'solana-mainnet']
        }
      },
      required: ['chain']
    }
  },
  {
    name: 'gateway_execute_rpc',
    description: "Execute blockchain RPC calls through Tatum's gateway infrastructure. Supports both JSON-RPC and REST API calls depending on the blockchain. For JSON-RPC methods, use simple method names like 'getblockcount' or 'eth_getBalance'. For REST calls, use full HTTP method and path like 'POST /getnowblock'. Parameters should be provided as an array for JSON-RPC or object for REST calls.",
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: "The blockchain network identifier. Examples: 'bitcoin-mainnet', 'ethereum-mainnet', 'litecoin-mainnet', 'polygon-mainnet', 'tron-mainnet', 'bsc-mainnet'. Use gateway_get_supported_chains to see all available networks.",
          examples: ['bitcoin-mainnet', 'ethereum-mainnet', 'litecoin-mainnet', 'polygon-mainnet']
        },
        method: {
          type: 'string',
          description: "The RPC method or REST endpoint to call. For JSON-RPC: use method names like 'getblockcount', 'getbestblockhash', 'eth_getBalance', 'eth_blockNumber'. For REST: use HTTP method + path like 'POST /getnowblock', 'GET /getinfo'. The gateway will automatically detect the protocol based on the format. Use gateway_get_supported_methods to see all available methods.",
          examples: ['getblockcount', 'getbestblockhash', 'eth_getBalance', 'POST /getnowblock']
        },
        params: {
          type: 'array',
          description: "Parameters for the RPC method. For JSON-RPC: provide as array (e.g., ['0x742d35Cc6074C4532895c05b22629ce5b3c28da4', 'latest'] for eth_getBalance). For REST: provide as array with single object element. Leave empty array [] if no parameters needed.",
          items: {},
          default: []
        }
      },
      required: ['chain', 'method']
    }
  }
];

export class GatewayService {
  private cachedGateways: Gateway[] = [];
  private cachedChains: string[] = [];
  private methodsCache: Map<string, any> = new Map();
  private dataFetched = false;
  private readonly BLOCKCHAINS_URL = 'https://blockchains.tatum.io/blockchains.json';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.UNIVERSAL_CRYPTO_API_KEY || '';
  }

  /**
   * Initialize the service by fetching blockchain data from external API
   */
  public async initialize(): Promise<void> {
    if (this.dataFetched) {
      return;
    }

    try {
      console.error('Fetching blockchain data from Tatum API...');
      const response = await fetch(this.BLOCKCHAINS_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const externalBlockchains: ExternalBlockchain[] = await response.json();
      
      // Transform external data to internal format
      this.cachedGateways = this.transformToGateways(externalBlockchains);
      this.cachedChains = this.extractChainNames(externalBlockchains);
      
      this.dataFetched = true;
      console.error(`Loaded ${this.cachedChains.length} networks from ${this.cachedGateways.length} blockchains`);
    } catch (error) {
      console.error('Failed to fetch blockchain data:', error instanceof Error ? error.message : 'Unknown error');
      
      // Fallback to empty data
      this.cachedGateways = [];
      this.cachedChains = [];
      this.dataFetched = true;
      
      throw new Error(`Failed to initialize GatewayService: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all available blockchain networks
   */
  public async getAvailableChains(): Promise<Gateway[]> {
    await this.ensureDataLoaded();
    return [...this.cachedGateways]; // Return a copy to prevent mutation
  }

  /**
   * Get supported chains as string array
   */
  public async getSupportedChains(): Promise<string[]> {
    await this.ensureDataLoaded();
    return [...this.cachedChains]; // Return a copy to prevent mutation
  }

  /**
   * Get gateway URL for a specific chain
   */
  public async getGatewayUrl(chainName: string): Promise<string | undefined> {
    await this.ensureDataLoaded();
    
    for (const gateway of this.cachedGateways) {
      const chain = gateway.chains.find(c => c.chain === chainName || c.gatewayName === chainName);
      if (chain) {
        return chain.gatewayUrl;
      }
    }
    return undefined;
  }

  /**
   * Get available methods for a specific gateway
   */
  public async getAvailableMethods(gatewayUrl: string): Promise<any> {
    // Check cache first
    if (this.methodsCache.has(gatewayUrl)) {
      return this.methodsCache.get(gatewayUrl);
    }

    try {
      const response = await fetch(`${gatewayUrl}/_methods`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Methods endpoint not available: ${response.status}`);
      }

      const methods = await response.json();
      this.methodsCache.set(gatewayUrl, methods);
      return methods;
    } catch (error) {
      throw new Error(`Failed to fetch methods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute RPC or REST request to gateway
   */
  public async executeRequest({
    gatewayUrl,
    method,
    body
  }: {
    gatewayUrl: string;
    method: string;
    body?: any;
  }): Promise<TatumApiResponse> {
    try {
      // Simple check: if method contains a space, assume it's a REST call (e.g., "POST /path").
      // Otherwise, assume it's a JSON-RPC call.
      if (method.includes(' ')) {
        return await this.executeRestRequest(gatewayUrl, method, body);
      } else {
        return await this.executeJsonRpcRequest(gatewayUrl, method, body);
      }
    } catch (error: any) {
      return {
        error: error.message || 'Request failed',
        status: error.status || 500,
        statusText: error.statusText || 'Error'
      };
    }
  }

  /**
   * Execute request with intelligent protocol detection based on chain
   */
  public async executeChainRequest({
    chainName,
    method,
    params = []
  }: {
    chainName: string;
    method: string;
    params?: any[];
  }): Promise<TatumApiResponse> {
    try {
      const gatewayUrl = await this.getGatewayUrl(chainName);
      if (!gatewayUrl) {
        return {
          error: `Gateway URL not found for chain: ${chainName}`,
          status: 404,
          statusText: 'Not Found'
        };
      }

      const protocol = getChainProtocol(chainName);
      const apiConfig = getChainApiConfig(chainName);
      
      if (protocol === 'rest') {
        // For REST chains, enhance method handling with chain-specific configurations
        let restMethod = method;
        
        // Handle chain-specific method formatting
        if (!method.includes(' ') && !method.startsWith('GET') && !method.startsWith('POST')) {
          // Add base path prefix if configured
          if (apiConfig.basePathPrefix && !method.startsWith(apiConfig.basePathPrefix)) {
            restMethod = `GET ${apiConfig.basePathPrefix}/${method.replace(/^\//, '')}`;
          } else {
            restMethod = `GET /${method.replace(/^\//, '')}`;
          }
        }
        
        // Special handling for specific chains
        if (chainName.startsWith('kadena-')) {
          // Kadena requires specific path structure
          if (!method.includes('chainweb')) {
            const network = chainName.includes('testnet') ? 'testnet04' : 'mainnet01';
            restMethod = `GET /chainweb/0.0/${network}/${method.replace(/^\//, '')}`;
          }
        } else if (chainName.startsWith('cardano-')) {
          // Cardano uses Blockfrost API structure
          if (!method.includes('api/v0')) {
            restMethod = `GET /api/v0/${method.replace(/^\//, '')}`;
          }
        } else if (chainName.startsWith('flow-')) {
          // Flow uses specific v1 API structure
          if (!method.includes('v1')) {
            restMethod = `GET /v1/${method.replace(/^\//, '')}`;
          }
        }
        
        return await this.executeRestRequestWithConfig(gatewayUrl, restMethod, params, apiConfig);
      } else {
        // For JSON-RPC chains like Ethereum
        return await this.executeJsonRpcRequest(gatewayUrl, method, params);
      }
    } catch (error: any) {
      return {
        error: error.message || 'Request failed',
        status: error.status || 500,
        statusText: error.statusText || 'Error'
      };
    }
  }

  /**
   * Execute JSON-RPC request
   */
  private async executeJsonRpcRequest(url: string, method: string, params: any[] = []): Promise<TatumApiResponse> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      })
    });

    const data = await response.json();
    return {
      data,
      status: response.status,
      statusText: response.statusText
    };
  }

  /**
   * Execute REST request with chain-specific configuration
   */
  private async executeRestRequestWithConfig(
    baseUrl: string, 
    methodPath: string, 
    params?: any, 
    apiConfig?: any
  ): Promise<TatumApiResponse> {
    const [httpMethod, restPath] = methodPath.includes(' ') 
      ? methodPath.split(' ') 
      : ['GET', methodPath];

    let url = `${baseUrl}${restPath}`;
    
    // Handle query parameters for GET requests
    if (httpMethod.toUpperCase() === 'GET' && params && Array.isArray(params) && params.length > 0) {
      const queryParams = new URLSearchParams();
      
      // If params is an array with a single object, use that object's properties as query params
      if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null) {
        const paramObj = params[0];
        Object.entries(paramObj).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
      }
      
      // If there are query parameters, append them to the URL
      if (queryParams.toString()) {
        url += (url.includes('?') ? '&' : '?') + queryParams.toString();
      }
    }
    
    const requestOptions: RequestInit = {
      method: httpMethod.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      }
    };

    // Add body for POST requests
    if (httpMethod.toUpperCase() === 'POST' && params) {
      requestOptions.body = JSON.stringify(params);
    }

    try {
      const response = await fetch(url, requestOptions);
      
      // Handle different response types
      let data: any;
      const contentType = response.headers.get('content-type');
      
      try {
        if (contentType && contentType.includes('application/json')) {
          // Try to parse as JSON
          const text = await response.text();
          if (text.trim()) {
            data = JSON.parse(text);
          } else {
            data = null; // Empty response
          }
        } else {
          // Non-JSON response, return as text
          data = await response.text();
        }
      } catch (parseError) {
        // If JSON parsing fails, try to get the raw text
        try {
          data = await response.text();
        } catch (textError) {
          data = { 
            error: 'Failed to parse response', 
            originalError: parseError,
            url: url,
            method: httpMethod
          };
        }
      }
      
      // Enhanced error handling based on chain configuration
      if (!response.ok) {
        const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
        return {
          error: errorMessage,
          status: response.status,
          statusText: response.statusText,
          data: data
        };
      }
      
      return {
        data,
        status: response.status,
        statusText: response.statusText
      };
    } catch (networkError: any) {
      return {
        error: `Network error: ${networkError.message}`,
        status: 500,
        statusText: 'Network Error',
        data: null
      };
    }
  }

  /**
   * Execute REST request (legacy method for backward compatibility)
   */
  private async executeRestRequest(baseUrl: string, methodPath: string, params?: any): Promise<TatumApiResponse> {
    return this.executeRestRequestWithConfig(baseUrl, methodPath, params);
  }

  /**
   * Transform external blockchain data to internal Gateway format
   */
  private transformToGateways(externalBlockchains: ExternalBlockchain[]): Gateway[] {
    return externalBlockchains.map(blockchain => ({
      name: blockchain.name,
      docs: blockchain.docs,
      chains: blockchain.chains.map(chain => ({
        chain: chain.chain,
        gatewayName: chain.gatewayName,
        gatewayUrl: chain.gatewayUrl
      }))
    }));
  }

  /**
   * Extract all chain names from external blockchain data
   */
  private extractChainNames(externalBlockchains: ExternalBlockchain[]): string[] {
    const chains: string[] = [];
    for (const blockchain of externalBlockchains) {
      for (const chain of blockchain.chains) {
        chains.push(chain.gatewayName);
      }
    }
    return chains;
  }

  /**
   * Ensure data is loaded before operations
   */
  private async ensureDataLoaded(): Promise<void> {
    if (!this.dataFetched) {
      await this.initialize();
    }
  }


}