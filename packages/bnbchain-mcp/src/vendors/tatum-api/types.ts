/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
export interface TatumFeature {
  feature: {
    name: string;
    description: string;
    category: string;
    version: string;
    authentication: {
      required: boolean;
      type: string;
      header: string;
    };
    supportedBlockchains: string[];
  };
  tools: TatumTool[];
  metadata: {
    generated: string;
    source_files: string[];
    endpoint_count: number;
    tool_count: number;
  };
}

export interface TatumTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

export interface TatumApiResponse {
  data?: any;
  error?: string;
  status: number;
  statusText: string;
}

export interface ToolExecutionContext {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

export interface GatewayChain {
  chain: string;
  gatewayName: string;
  gatewayUrl: string;
}

export interface Gateway {
  name: string;
  docs: string;
  chains: GatewayChain[];
}

export interface GatewayFeature {
  feature: {
    name: string;
    description: string;
    category: string;
    version: string;
    authentication: {
      required: boolean;
      type: string;
      header: string;
    };
  };
  tools: TatumTool[];
  gateways: Gateway[];
  metadata: {
    generated: string;
    source_url: string;
    gateway_count: number;
  };
}

// New types for external blockchain data from https://blockchains.tatum.io/blockchains.json
export interface ExternalBlockchainChain {
  archive: boolean;
  chain: string;
  explorer?: string;
  gatewayName: string;
  gatewayUrl: string;
  slugAliases: string[];
  tier: number;
}

export interface ExternalBlockchain {
  chains: ExternalBlockchainChain[];
  description: string;
  docs: string;
  excerpt: string;
  icon: string;
  id: string;
  name: string;
  public: boolean;
  sdk: {
    interface: string[];
    network: string[];
  };
  tags: string[];
  tier: number;
  type: string;
  website: string;
}