/**
 * Lyra Registry Service
 * @description MCP tool catalog with x402 payments
 * @author nirholas
 * @license Apache-2.0
 * 
 * Lyra Registry provides:
 * - Free: Browse tools catalog
 * - $0.01: Detailed tool info + examples
 * - $0.05: Private tool registration
 * - $10/mo: Featured listing
 */

import type { AxiosInstance } from "axios";
import type {
  LyraRegistryConfig,
  ToolInfo,
  DetailedToolInfo,
  PrivateToolRegistration,
  FeaturedListingRequest,
  LyraPaymentResult,
} from "./types.js";
import { LYRA_SERVICE_URLS, LYRA_PRICES, LYRA_API_VERSION, TOOL_CATEGORIES } from "./constants.js";
import Logger from "@/utils/logger.js";

/**
 * Search/filter options for browsing tools
 */
export interface BrowseToolsOptions {
  query?: string;
  category?: typeof TOOL_CATEGORIES[number];
  tags?: string[];
  minStars?: number;
  sortBy?: "stars" | "downloads" | "updated" | "name";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Paginated response for tool listings
 */
export interface ToolListResponse {
  tools: ToolInfo[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Result of private tool registration
 */
export interface RegistrationResult {
  success: boolean;
  toolId: string;
  apiKey: string;
  webhookSecret?: string;
  message: string;
}

/**
 * Featured listing confirmation
 */
export interface FeaturedListingResult {
  success: boolean;
  toolId: string;
  featuredUntil: string;
  tier: "basic" | "premium" | "spotlight";
  invoiceId: string;
}

/**
 * Lyra Registry service client with x402 payment integration
 */
export class LyraRegistry {
  private api: AxiosInstance;
  private config: Required<LyraRegistryConfig>;
  private paymentCallback?: (result: LyraPaymentResult) => void;

  constructor(
    api: AxiosInstance,
    config: LyraRegistryConfig = {},
    onPayment?: (result: LyraPaymentResult) => void
  ) {
    this.api = api;
    this.config = {
      baseUrl: config.baseUrl ?? LYRA_SERVICE_URLS.registry.production,
      apiKey: config.apiKey ?? "",
    };
    this.paymentCallback = onPayment;
  }

  // ==========================================================================
  // Free Tier: Browse Tools
  // ==========================================================================

  /**
   * Browse the tool catalog (FREE)
   * 
   * @example
   * ```typescript
   * const tools = await registry.browse({ category: "blockchain" });
   * tools.forEach(t => console.log(`${t.name}: ${t.stars}⭐`));
   * ```
   */
  async browse(options: BrowseToolsOptions = {}): Promise<ToolListResponse> {
    Logger.debug(`[LyraRegistry] Browsing tools`, options);

    const response = await this.api.get<ToolListResponse>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools`,
      {
        params: {
          q: options.query,
          category: options.category,
          tags: options.tags?.join(","),
          minStars: options.minStars,
          sort: options.sortBy ?? "stars",
          order: options.sortOrder ?? "desc",
          page: options.page ?? 1,
          limit: options.limit ?? 20,
        },
      }
    );

    return response.data;
  }

  /**
   * Get basic info about a tool (FREE)
   */
  async getToolInfo(toolId: string): Promise<ToolInfo> {
    const response = await this.api.get<ToolInfo>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/${toolId}/info`
    );
    return response.data;
  }

  /**
   * Search tools by name or description (FREE)
   */
  async search(query: string, limit = 10): Promise<ToolInfo[]> {
    const response = await this.browse({ query, limit });
    return response.tools;
  }

  /**
   * List tools by category (FREE)
   */
  async listByCategory(category: typeof TOOL_CATEGORIES[number]): Promise<ToolInfo[]> {
    const response = await this.browse({ category, limit: 50 });
    return response.tools;
  }

  /**
   * Get trending tools (FREE)
   */
  async getTrending(limit = 10): Promise<ToolInfo[]> {
    const response = await this.api.get<ToolInfo[]>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/trending`,
      { params: { limit } }
    );
    return response.data;
  }

  // ==========================================================================
  // $0.01: Detailed Tool Info
  // ==========================================================================

  /**
   * Get detailed tool information with examples ($0.01)
   * 
   * Includes:
   * - Full README
   * - Code examples
   * - Configuration options
   * - Compatibility info
   * - Changelog
   * 
   * @example
   * ```typescript
   * const details = await registry.getToolDetails("mcp-server-filesystem");
   * console.log(details.examples[0].code);
   * ```
   */
  async getToolDetails(toolId: string): Promise<DetailedToolInfo> {
    Logger.info(`[LyraRegistry] Getting tool details: ${toolId} (cost: $${LYRA_PRICES.registry.toolDetails})`);

    const response = await this.api.get<DetailedToolInfo & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/${toolId}/details`
    );

    if (response.data.payment && this.paymentCallback) {
      this.paymentCallback(response.data.payment);
    }

    const result = { ...response.data };
    delete (result as Record<string, unknown>).payment;

    return result;
  }

  /**
   * Get tool examples only ($0.01)
   */
  async getToolExamples(toolId: string): Promise<DetailedToolInfo["examples"]> {
    const details = await this.getToolDetails(toolId);
    return details.examples;
  }

  /**
   * Get tool configuration guide ($0.01)
   */
  async getToolConfiguration(toolId: string): Promise<DetailedToolInfo["configuration"]> {
    const details = await this.getToolDetails(toolId);
    return details.configuration;
  }

  // ==========================================================================
  // $0.05: Private Tool Registration
  // ==========================================================================

  /**
   * Register a private tool ($0.05)
   * 
   * Register your MCP server tool in the Lyra Registry:
   * - Private: Only you can see it
   * - Organization: Shared with your org
   * - Public: Listed in the catalog
   * 
   * @example
   * ```typescript
   * const result = await registry.registerTool({
   *   name: "my-mcp-tool",
   *   description: "My custom MCP tool",
   *   version: "1.0.0",
   *   endpoint: "https://api.mytool.com/mcp",
   *   category: "utilities",
   *   visibility: "private"
   * });
   * console.log(`Tool ID: ${result.toolId}`);
   * ```
   */
  async registerTool(registration: PrivateToolRegistration): Promise<RegistrationResult> {
    Logger.info(`[LyraRegistry] Registering tool: ${registration.name} (cost: $${LYRA_PRICES.registry.privateRegistration})`);

    const response = await this.api.post<RegistrationResult & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/register`,
      registration,
      {
        headers: this.config.apiKey ? { "X-API-Key": this.config.apiKey } : {},
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
   * Update a registered tool
   */
  async updateTool(
    toolId: string,
    updates: Partial<PrivateToolRegistration>
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.api.patch<{ success: boolean; message: string }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/${toolId}`,
      updates,
      {
        headers: this.config.apiKey ? { "X-API-Key": this.config.apiKey } : {},
      }
    );
    return response.data;
  }

  /**
   * Delete a registered tool
   */
  async deleteTool(toolId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.delete<{ success: boolean; message: string }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/${toolId}`,
      {
        headers: this.config.apiKey ? { "X-API-Key": this.config.apiKey } : {},
      }
    );
    return response.data;
  }

  // ==========================================================================
  // $10/mo: Featured Listing
  // ==========================================================================

  /**
   * Request a featured listing ($10/month)
   * 
   * Featured tools get:
   * - Homepage placement
   * - Search result priority
   * - "Featured" badge
   * - Analytics dashboard
   * 
   * @example
   * ```typescript
   * const listing = await registry.requestFeaturedListing({
   *   toolId: "my-tool-id",
   *   featuredUntil: new Date("2026-02-27"),
   *   tier: "premium"
   * });
   * ```
   */
  async requestFeaturedListing(request: FeaturedListingRequest): Promise<FeaturedListingResult> {
    Logger.info(`[LyraRegistry] Featured listing: ${request.toolId} (cost: $${LYRA_PRICES.registry.featuredListing}/mo)`);

    const response = await this.api.post<FeaturedListingResult & { payment?: LyraPaymentResult }>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/${request.toolId}/feature`,
      {
        featuredUntil: request.featuredUntil.toISOString(),
        tier: request.tier,
        customDescription: request.customDescription,
      },
      {
        headers: this.config.apiKey ? { "X-API-Key": this.config.apiKey } : {},
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
   * Get featured tools listing
   */
  async getFeaturedTools(): Promise<ToolInfo[]> {
    const response = await this.api.get<ToolInfo[]>(
      `${this.config.baseUrl}/${LYRA_API_VERSION}/tools/featured`
    );
    return response.data;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get all available categories
   */
  getCategories(): readonly string[] {
    return TOOL_CATEGORIES;
  }

  /**
   * Get pricing information for Lyra Registry services
   */
  getPricing(): typeof LYRA_PRICES.registry {
    return LYRA_PRICES.registry;
  }

  /**
   * Check estimated cost before running an operation
   */
  estimateCost(operation: keyof typeof LYRA_PRICES.registry): string {
    return LYRA_PRICES.registry[operation];
  }
}
