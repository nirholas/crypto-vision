/**
 * Lyra Ecosystem Payment Layer
 * @description Unified x402 payment integration for lyra-intel, lyra-registry, lyra-tool-discovery
 * @author nirholas
 * @license Apache-2.0
 * 
 * @example Quick Start
 * ```typescript
 * import { LyraClient } from "@/modules/lyra-ecosystem";
 * 
 * const lyra = new LyraClient({
 *   x402Wallet: process.env.X402_PRIVATE_KEY
 * });
 * 
 * // All Lyra services, one payment layer
 * await lyra.intel.securityScan(repoUrl);    // $0.05
 * await lyra.registry.getToolDetails(id);     // $0.01  
 * await lyra.discovery.analyze(apiUrl);       // $0.02
 * ```
 * 
 * ## Services
 * 
 * ### Lyra Intel (9⭐)
 * Code analysis and security scanning
 * - Free: Basic file analysis
 * - $0.05: Security scan
 * - $0.10: Full repo audit
 * - $1.00: Enterprise analysis (monorepos)
 * 
 * ### Lyra Registry (9⭐)
 * MCP tool catalog
 * - Free: Browse tools
 * - $0.01: Detailed tool info + examples
 * - $0.05: Private tool registration
 * - $10/mo: Featured listing
 * 
 * ### Lyra Tool Discovery (6⭐)
 * Automatic API discovery
 * - Free: Basic discovery
 * - $0.02: AI-analyzed compatibility
 * - $0.10: Auto-generated MCP config
 * - $0.50: Full integration assistance
 * 
 * @packageDocumentation
 */

// Main client
export { 
  LyraClient, 
  getLyraClient, 
  setLyraClient, 
  resetLyraClient 
} from "./client.js";

// Individual services
export { LyraIntel } from "./intel.js";
export { LyraRegistry } from "./registry.js";
export { LyraDiscovery } from "./discovery.js";

// MCP integration
export { registerLyraTools } from "./tools.js";

// Types
export type {
  // Common
  LyraServiceName,
  LyraPaymentResult,
  LyraUsageStats,
  ServiceUsage,
  LyraClientConfig,
  LyraPricingTier,
  
  // Intel types
  LyraIntelConfig,
  FileAnalysisResult,
  SecurityScanResult,
  RepoAuditResult,
  EnterpriseAnalysisResult,
  Vulnerability,
  AuditIssue,
  RepoMetrics,
  
  // Registry types
  LyraRegistryConfig,
  ToolInfo,
  DetailedToolInfo,
  ToolExample,
  ToolConfiguration,
  ToolDependency,
  ToolPricing,
  PrivateToolRegistration,
  FeaturedListingRequest,
  
  // Discovery types
  LyraDiscoveryConfig,
  DiscoveryResult,
  DiscoveredTool,
  CompatibilityAnalysis,
  CompatibilityIssue,
  CompatibilitySuggestion,
  McpConfigResult,
  McpServerConfig,
  IntegrationAssistance,
  CodeSnippet,
  TestCase,

  // Multi-chain types
  LyraWalletConfig,
  LyraChainPreference,
} from "./types.js";

// Constants
export {
  LYRA_SERVICE_URLS,
  LYRA_REPOS,
  LYRA_PRICES,
  LYRA_RATE_LIMITS,
  LYRA_SUPPORTED_NETWORKS,
  LYRA_DEFAULT_NETWORK,
  LYRA_FACILITATOR_URL,
  LYRA_TREASURY_ADDRESS,
  LYRA_TREASURY_ADDRESSES,
  LYRA_API_VERSION,
  LYRA_CACHE_CONFIG,
  SUPPORTED_LANGUAGES,
  TOOL_CATEGORIES,
  DISCOVERABLE_PROTOCOLS,
  // Multi-chain exports
  LYRA_NETWORKS,
  LYRA_RECOMMENDED_NETWORKS,
  LYRA_CHAIN_FACILITATORS,
  // Sperax USDs integration
  SPERAX_CONTRACTS,
  USDS_BENEFITS,
  PAYMENT_TOKENS,
  DEFAULT_TOKEN_PER_CHAIN,
  type LyraNetworkId,
  type LyraNetworkConfig,
  type PaymentToken,
} from "./constants.js";

// Pricing constant for convenience
export { LYRA_PRICING } from "./types.js";
