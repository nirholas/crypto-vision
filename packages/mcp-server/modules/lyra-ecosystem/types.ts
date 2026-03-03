/**
 * Lyra Ecosystem Types
 * @description Type definitions for the Lyra unified payment layer
 * @author nirholas
 * @license Apache-2.0
 */

// ============================================================================
// Common Types
// ============================================================================

export type LyraServiceName = "intel" | "registry" | "discovery";

export interface LyraPaymentResult {
  success: boolean;
  transactionHash?: string;
  amount: string;
  service: LyraServiceName;
  operation: string;
  timestamp: number;
  network: string;
}

export interface LyraUsageStats {
  totalSpent: string;
  requestCount: number;
  byService: Record<LyraServiceName, ServiceUsage>;
  period: "day" | "week" | "month" | "all";
}

export interface ServiceUsage {
  spent: string;
  requests: number;
  lastUsed?: number;
}

// ============================================================================
// Lyra Intel Types
// ============================================================================

export interface LyraIntelConfig {
  baseUrl?: string;
  enableCaching?: boolean;
  cacheTtlMs?: number;
}

export interface FileAnalysisResult {
  filename: string;
  language: string;
  complexity: number;
  linesOfCode: number;
  functions: number;
  classes: number;
  suggestions: string[];
}

export interface SecurityScanResult {
  severity: "low" | "medium" | "high" | "critical";
  vulnerabilities: Vulnerability[];
  score: number;
  summary: string;
  recommendations: string[];
}

export interface Vulnerability {
  id: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  description: string;
  recommendation: string;
  cweId?: string;
}

export interface RepoAuditResult {
  repository: string;
  totalFiles: number;
  analyzedFiles: number;
  securityScore: number;
  codeQualityScore: number;
  maintainabilityScore: number;
  overallScore: number;
  issues: AuditIssue[];
  recommendations: string[];
  metrics: RepoMetrics;
}

export interface AuditIssue {
  category: "security" | "quality" | "performance" | "maintainability";
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  file?: string;
  line?: number;
  rule?: string;
}

export interface RepoMetrics {
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  testCoverage?: number;
  technicalDebt?: string;
  duplicateCode?: number;
}

export interface EnterpriseAnalysisResult extends RepoAuditResult {
  monorepoInfo: {
    packages: number;
    sharedDependencies: string[];
    circularDependencies: string[][];
  };
  crossPackageIssues: AuditIssue[];
  dependencyGraph: Record<string, string[]>;
  buildOptimizations: string[];
  architectureRecommendations: string[];
}

// ============================================================================
// Lyra Registry Types
// ============================================================================

export interface LyraRegistryConfig {
  baseUrl?: string;
  apiKey?: string;
}

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  stars: number;
  downloads: number;
  lastUpdated: string;
  homepage?: string;
  repository?: string;
}

export interface DetailedToolInfo extends ToolInfo {
  readme: string;
  examples: ToolExample[];
  configuration: ToolConfiguration;
  dependencies: ToolDependency[];
  changelog: ChangelogEntry[];
  compatibility: CompatibilityInfo;
  pricing?: ToolPricing;
}

export interface ToolExample {
  title: string;
  description: string;
  code: string;
  language: string;
}

export interface ToolConfiguration {
  required: ConfigOption[];
  optional: ConfigOption[];
  envVars: EnvVarConfig[];
}

export interface ConfigOption {
  name: string;
  type: string;
  description: string;
  default?: string | number | boolean;
}

export interface EnvVarConfig {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

export interface ToolDependency {
  name: string;
  version: string;
  type: "runtime" | "dev" | "peer";
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface CompatibilityInfo {
  nodeVersions: string[];
  mcpVersions: string[];
  platforms: string[];
}

export interface ToolPricing {
  type: "free" | "freemium" | "paid" | "subscription";
  price?: string;
  subscriptionPrice?: string;
}

export interface PrivateToolRegistration {
  name: string;
  description: string;
  version: string;
  endpoint: string;
  category: string;
  tags?: string[];
  pricing?: ToolPricing;
  visibility: "private" | "organization" | "public";
}

export interface FeaturedListingRequest {
  toolId: string;
  featuredUntil: Date;
  tier: "basic" | "premium" | "spotlight";
  customDescription?: string;
}

// ============================================================================
// Lyra Tool Discovery Types
// ============================================================================

export interface LyraDiscoveryConfig {
  baseUrl?: string;
  enableAutoDiscovery?: boolean;
}

export interface DiscoveryResult {
  apiUrl: string;
  detected: boolean;
  protocol: "mcp" | "openapi" | "graphql" | "grpc" | "unknown";
  tools: DiscoveredTool[];
  timestamp: number;
}

export interface DiscoveredTool {
  name: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  description?: string;
  parameters?: ToolParameter[];
}

export interface ToolParameter {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface CompatibilityAnalysis {
  apiUrl: string;
  mcpCompatible: boolean;
  compatibilityScore: number;
  issues: CompatibilityIssue[];
  suggestions: CompatibilitySuggestion[];
  estimatedEffort: "low" | "medium" | "high";
}

export interface CompatibilityIssue {
  type: "breaking" | "warning" | "info";
  message: string;
  endpoint?: string;
}

export interface CompatibilitySuggestion {
  priority: "high" | "medium" | "low";
  description: string;
  implementationHint?: string;
}

export interface McpConfigResult {
  generated: boolean;
  config: McpServerConfig;
  warnings: string[];
  setupInstructions: string[];
}

export interface McpServerConfig {
  name: string;
  version: string;
  description: string;
  tools: McpToolConfig[];
  resources?: McpResourceConfig[];
  prompts?: McpPromptConfig[];
}

export interface McpToolConfig {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: string;
}

export interface McpResourceConfig {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface McpPromptConfig {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface IntegrationAssistance {
  apiUrl: string;
  fullAnalysis: CompatibilityAnalysis;
  generatedConfig: McpConfigResult;
  codeSnippets: CodeSnippet[];
  testCases: TestCase[];
  documentation: string;
  supportContact?: string;
}

export interface CodeSnippet {
  title: string;
  language: string;
  code: string;
  description: string;
}

export interface TestCase {
  name: string;
  description: string;
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
}

// ============================================================================
// Lyra Client Types
// ============================================================================

/**
 * Multi-chain wallet configuration
 */
export interface LyraWalletConfig {
  /** EVM private key (hex with 0x prefix) - works for Base, Arbitrum, BSC, Ethereum, Polygon, Optimism */
  evmPrivateKey?: `0x${string}`;
  /** Solana private key (base58 encoded) */
  svmPrivateKey?: string;
  /** Legacy: Single wallet key (EVM format, use evmPrivateKey instead) */
  privateKey?: string;
}

/**
 * Chain preference configuration
 */
export interface LyraChainPreference {
  /** Primary chain for payments */
  primary: string;
  /** Fallback chains if primary fails */
  fallbacks?: string[];
  /** Prefer chains with lowest fees */
  preferLowFees?: boolean;
  /** Only use testnet chains */
  testnetOnly?: boolean;
}

export interface LyraClientConfig {
  /** @deprecated Use wallets.evmPrivateKey instead */
  x402Wallet?: string;
  /** @deprecated Use wallets.evmPrivateKey instead */
  x402PrivateKey?: string;
  /** Multi-chain wallet configuration */
  wallets?: LyraWalletConfig;
  /** Primary payment network (e.g., "base", "arbitrum", "bsc", "solana-mainnet") */
  network?: string;
  /** Chain preference settings */
  chainPreference?: LyraChainPreference;
  /** Maximum daily spend in USD */
  maxDailySpend?: string;
  /** Automatically pay for services */
  autoPayEnabled?: boolean;
  /** Preferred stablecoin ("USDC" | "USDT" | "USDs") */
  preferredToken?: "USDC" | "USDT" | "USDs";
  /** Intel service config */
  intel?: LyraIntelConfig;
  /** Registry service config */
  registry?: LyraRegistryConfig;
  /** Discovery service config */
  discovery?: LyraDiscoveryConfig;
}

export interface LyraPricingTier {
  service: LyraServiceName;
  operation: string;
  price: string;
  description: string;
  rateLimit?: number;
}

// Default pricing from the spec
export const LYRA_PRICING: Record<string, LyraPricingTier[]> = {
  intel: [
    { service: "intel", operation: "fileAnalysis", price: "0.00", description: "Basic file analysis" },
    { service: "intel", operation: "securityScan", price: "0.05", description: "Security vulnerability scan" },
    { service: "intel", operation: "repoAudit", price: "0.10", description: "Full repository audit" },
    { service: "intel", operation: "enterpriseAnalysis", price: "1.00", description: "Enterprise monorepo analysis" },
  ],
  registry: [
    { service: "registry", operation: "browse", price: "0.00", description: "Browse tools catalog" },
    { service: "registry", operation: "toolDetails", price: "0.01", description: "Detailed tool info + examples" },
    { service: "registry", operation: "privateRegistration", price: "0.05", description: "Private tool registration" },
    { service: "registry", operation: "featuredListing", price: "10.00", description: "Featured listing (monthly)" },
  ],
  discovery: [
    { service: "discovery", operation: "basicDiscovery", price: "0.00", description: "Basic API discovery" },
    { service: "discovery", operation: "compatibility", price: "0.02", description: "AI-analyzed compatibility" },
    { service: "discovery", operation: "generateConfig", price: "0.10", description: "Auto-generated MCP config" },
    { service: "discovery", operation: "fullAssistance", price: "0.50", description: "Full integration assistance" },
  ],
};
