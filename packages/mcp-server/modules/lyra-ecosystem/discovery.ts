/**
 * Lyra Tool Discovery Service
 * @description Automatic MCP tool discovery with x402 payments
 * @author nirholas
 * @license Apache-2.0
 * 
 * Lyra Tool Discovery provides:
 * - Free: Basic API discovery
 * - $0.02: AI-analyzed compatibility
 * - $0.10: Auto-generated MCP config
 * - $0.50: Full integration assistance
 */

import type { AxiosInstance } from "axios";
import type {
  LyraDiscoveryConfig,
  DiscoveryResult,
  CompatibilityAnalysis,
  McpConfigResult,
  IntegrationAssistance,
  LyraPaymentResult,
} from "./types.js";
import { LYRA_SERVICE_URLS, LYRA_PRICES, LYRA_API_VERSION, DISCOVERABLE_PROTOCOLS } from "./constants.js";
import Logger from "@/utils/logger.js";

/**
 * Options for API discovery
 */
export interface DiscoveryOptions {
  /** Force re-discovery even if cached */
  forceRefresh?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Include authentication headers for protected APIs */
  auth?: {
    type: "bearer" | "basic" | "apikey";
    value: string;
  };
}

/**
 * Lyra Tool Discovery service client with x402 payment integration
 */
export class LyraDiscovery {
  private api: AxiosInstance;
  private config: Required<LyraDiscoveryConfig>;
  private discoveryCache: Map<string, { result: DiscoveryResult; expires: number }>;
  private paymentCallback?: (result: LyraPaymentResult) => void;

  constructor(
    api: AxiosInstance,
    config: LyraDiscoveryConfig = {},
    onPayment?: (result: LyraPaymentResult) => void
  ) {
    this.api = api;
    this.config = {
      baseUrl: config.baseUrl ?? LYRA_SERVICE_URLS.discovery.production,
      enableAutoDiscovery: config.enableAutoDiscovery ?? true,
    };
    this.discoveryCache = new Map();
    this.paymentCallback = onPayment;
  }

  // ==========================================================================
  // Free Tier: Basic Discovery
  // ==========================================================================

  /**
   * Discover API endpoints (FREE)
   * 
   * Automatically detects:
   * - MCP servers
   * - OpenAPI/Swagger endpoints
   * - GraphQL schemas
   * - gRPC services
   * 
   * @example
   * ```typescript
   * const result = await discovery.discover("https://api.example.com");
   * console.log(`Protocol: ${result.protocol}`);
   * console.log(`Found ${result.tools.length} tools`);
   * ```
   */
  async discover(apiUrl: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
    const cacheKey = `discover:${apiUrl}`;
    
    if (!options.forceRefresh) {
      const cached = this.discoveryCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return cached.result;
      }
    }

    Logger.debug(`[LyraDiscovery] Discovering: ${apiUrl}`);

    const response = await this.api.post<DiscoveryResult>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/discover`,
      {
        url: apiUrl,
        auth: options.auth,
      },
      {
        timeout: options.timeout ?? 30000,
      }
    );

    // Cache for 1 hour
    this.discoveryCache.set(cacheKey, {
      result: response.data,
      expires: Date.now() + 60 * 60 * 1000,
    });

    return response.data;
  }

  /**
   * Check if an API is MCP compatible (FREE)
   */
  async isMcpCompatible(apiUrl: string): Promise<boolean> {
    const result = await this.discover(apiUrl);
    return result.protocol === "mcp";
  }

  /**
   * Get detected protocol type (FREE)
   */
  async detectProtocol(apiUrl: string): Promise<typeof DISCOVERABLE_PROTOCOLS[number] | "unknown"> {
    const result = await this.discover(apiUrl);
    return result.protocol === "unknown" ? "unknown" : result.protocol;
  }

  /**
   * List discovered tools from an API (FREE)
   */
  async listTools(apiUrl: string): Promise<DiscoveryResult["tools"]> {
    const result = await this.discover(apiUrl);
    return result.tools;
  }

  // ==========================================================================
  // $0.02: AI-Analyzed Compatibility
  // ==========================================================================

  /**
   * Analyze API compatibility with MCP ($0.02)
   * 
   * AI-powered analysis that:
   * - Evaluates endpoint compatibility
   * - Identifies potential issues
   * - Provides migration suggestions
   * - Estimates implementation effort
   * 
   * @example
   * ```typescript
   * const analysis = await discovery.analyzeCompatibility("https://api.example.com");
   * console.log(`MCP Compatible: ${analysis.mcpCompatible}`);
   * console.log(`Score: ${analysis.compatibilityScore}/100`);
   * ```
   */
  async analyzeCompatibility(apiUrl: string): Promise<CompatibilityAnalysis> {
    Logger.info(`[LyraDiscovery] Analyzing compatibility: ${apiUrl} (cost: $${LYRA_PRICES.discovery.compatibility})`);

    const response = await this.api.post<CompatibilityAnalysis & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/analyze/compatibility`,
      { url: apiUrl }
    );

    if (response.data.payment && this.paymentCallback) {
      this.paymentCallback(response.data.payment);
    }

    const result = { ...response.data };
    delete (result as Record<string, unknown>).payment;

    return result;
  }

  /**
   * Alias for analyzeCompatibility
   * This is the method mentioned in the spec
   */
  async analyze(apiUrl: string): Promise<CompatibilityAnalysis> {
    return this.analyzeCompatibility(apiUrl);
  }

  /**
   * Get compatibility score only ($0.02)
   */
  async getCompatibilityScore(apiUrl: string): Promise<number> {
    const analysis = await this.analyzeCompatibility(apiUrl);
    return analysis.compatibilityScore;
  }

  // ==========================================================================
  // $0.10: Auto-Generated MCP Config
  // ==========================================================================

  /**
   * Generate MCP server configuration ($0.10)
   * 
   * Automatically generates:
   * - MCP server config file
   * - Tool definitions with schemas
   * - Resource configurations
   * - Prompt templates
   * 
   * @example
   * ```typescript
   * const config = await discovery.generateMcpConfig("https://api.example.com");
   * console.log(JSON.stringify(config.config, null, 2));
   * ```
   */
  async generateMcpConfig(
    apiUrl: string,
    options?: {
      serverName?: string;
      version?: string;
      includeResources?: boolean;
      includePrompts?: boolean;
    }
  ): Promise<McpConfigResult> {
    Logger.info(`[LyraDiscovery] Generating MCP config: ${apiUrl} (cost: $${LYRA_PRICES.discovery.generateConfig})`);

    const response = await this.api.post<McpConfigResult & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/generate/mcp-config`,
      {
        url: apiUrl,
        serverName: options?.serverName,
        version: options?.version ?? "1.0.0",
        includeResources: options?.includeResources ?? true,
        includePrompts: options?.includePrompts ?? true,
      }
    );

    if (response.data.payment && this.paymentCallback) {
      this.paymentCallback(response.data.payment);
    }

    const result = { ...response.data };
    delete (result as Record<string, unknown>).payment;

    return result;
  }

  /**
   * Generate tool definitions only ($0.10)
   */
  async generateToolDefinitions(apiUrl: string): Promise<McpConfigResult["config"]["tools"]> {
    const config = await this.generateMcpConfig(apiUrl, {
      includeResources: false,
      includePrompts: false,
    });
    return config.config.tools;
  }

  // ==========================================================================
  // $0.50: Full Integration Assistance
  // ==========================================================================

  /**
   * Get full integration assistance ($0.50)
   * 
   * Complete integration package:
   * - Compatibility analysis
   * - Generated MCP config
   * - Code snippets for integration
   * - Test cases
   * - Documentation
   * - Support contact
   * 
   * @example
   * ```typescript
   * const assistance = await discovery.getFullAssistance("https://api.example.com");
   * 
   * // Use generated code snippets
   * assistance.codeSnippets.forEach(snippet => {
   *   console.log(`// ${snippet.title}`);
   *   console.log(snippet.code);
   * });
   * ```
   */
  async getFullAssistance(
    apiUrl: string,
    options?: {
      targetLanguage?: "typescript" | "python" | "javascript";
      includeTests?: boolean;
      generateDocs?: boolean;
    }
  ): Promise<IntegrationAssistance> {
    Logger.info(`[LyraDiscovery] Full integration assistance: ${apiUrl} (cost: $${LYRA_PRICES.discovery.fullAssistance})`);

    const response = await this.api.post<IntegrationAssistance & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/assist/integration`,
      {
        url: apiUrl,
        targetLanguage: options?.targetLanguage ?? "typescript",
        includeTests: options?.includeTests ?? true,
        generateDocs: options?.generateDocs ?? true,
      }
    );

    if (response.data.payment && this.paymentCallback) {
      this.paymentCallback(response.data.payment);
    }

    const result = { ...response.data };
    delete (result as Record<string, unknown>).payment;

    return result;
  }

  /**
   * Get code snippets for integration ($0.50)
   */
  async getCodeSnippets(
    apiUrl: string,
    language: "typescript" | "python" | "javascript" = "typescript"
  ): Promise<IntegrationAssistance["codeSnippets"]> {
    const assistance = await this.getFullAssistance(apiUrl, { targetLanguage: language });
    return assistance.codeSnippets;
  }

  /**
   * Get test cases for integration ($0.50)
   */
  async getTestCases(apiUrl: string): Promise<IntegrationAssistance["testCases"]> {
    const assistance = await this.getFullAssistance(apiUrl, { includeTests: true });
    return assistance.testCases;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get supported protocols for discovery
   */
  getSupportedProtocols(): readonly string[] {
    return DISCOVERABLE_PROTOCOLS;
  }

  /**
   * Get pricing information for Lyra Discovery services
   */
  getPricing(): typeof LYRA_PRICES.discovery {
    return LYRA_PRICES.discovery;
  }

  /**
   * Check estimated cost before running an operation
   */
  estimateCost(operation: keyof typeof LYRA_PRICES.discovery): string {
    return LYRA_PRICES.discovery[operation];
  }

  /**
   * Clear the discovery cache
   */
  clearCache(): void {
    this.discoveryCache.clear();
  }
}
