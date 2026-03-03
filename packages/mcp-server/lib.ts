/**
 * Library entry point - exports for use as a dependency
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 * 
 * @example Quick Start - EVM Operations
 * ```typescript
 * import { registerEVM } from "@nirholas/universal-crypto-mcp";
 * registerEVM(server);
 * ```
 * 
 * @example Quick Start - x402 Payments
 * ```typescript
 * import { registerX402 } from "@nirholas/universal-crypto-mcp";
 * registerX402(server);
 * ```
 */

// ============================================================
// EVM Module Exports
// ============================================================
export { registerEVM } from "./evm/index.js"
export * from "./evm/chains.js"
export * from "./evm/services/index.js"

// ============================================================
// x402 Payment Protocol Exports
// ============================================================
export {
  // Main registration function
  registerX402,
  x402Status,
  
  // Client utilities
  createX402Client,
  createPaymentAxios,
  createPaymentFetch,
  getDefaultClient,
  resetDefaultClient,
  wrapAxiosWithPayment,
  wrapFetchWithPayment,
  x402Client,
  
  // Legacy SDK
  X402Client,
  fetchWith402Handling,
  HTTP402Handler,
  createPaymentGate,
  createDynamicPaymentGate,
  YieldTracker,
  
  // Server-side (receiving payments)
  x402Paywall,
  x402DynamicPaywall,
  x402PaywallFastify,
  x402PaywallHono,
  x402PaywallKoa,
  x402ExtractPayment,
  x402TrackPayment,
  x402RateLimit,
  X402PaymentVerifier,
  InMemoryNonceStore,
  createVerifier,
  X402Facilitator,
  createCoinbaseFacilitator,
  createSelfHostedFacilitator,
  createFacilitatorFromEnv,
  
  // Pricing strategies
  dynamicPrice,
  fixedPrice,
  tieredPrice,
  timeBasedPrice,
  resourceBasedPrice,
  compositePrice,
  
  // Analytics
  X402Analytics,
  createFileAnalytics,
  createMemoryAnalytics,
  
  // Configuration
  loadX402Config,
  loadLegacyX402Config,
  isX402Configured,
  isEvmConfigured,
  isSvmConfigured,
  validateX402Config,
  getChainType,
  getCaip2FromChain,
  getChainFromCaip2,
  getTokenConfig,
  getUsdcAddress,
  SUPPORTED_CHAINS,
  EVM_CHAINS,
  SVM_CHAINS,
  
  // Security
  validatePrivateKeyFormat,
  loadPrivateKeySecure,
  isKeySourceSecure,
  validateAndChecksumAddress,
  isChecksumValid,
  maskSensitiveData,
  sanitizeForLogging,
  logSecurityEvent,
  getSecurityEvents,
  isProductionEnvironment,
  requireMainnetOptIn,
  isTestnetOnly,
  registerExternalSigner,
  hasExternalSigner,
  getExternalSigner,
  generateSecureNonce,
  
  // Payment limits
  DEFAULT_LIMITS,
  getPaymentLimits,
  setPaymentLimits,
  getDailySpending,
  recordPayment,
  getTodayPayments,
  validatePaymentLimits,
  isServiceApproved,
  approveService,
  removeService,
  getApprovedServices,
  setStrictAllowlistMode,
  isStrictAllowlistMode,
  addToPaymentHistory,
  updatePaymentStatus,
  getPaymentHistory,
  getPaymentStats,
  
  // Input validation
  validateURL,
  getURLValidationOptions,
  validateAmount,
  validateAddress,
  validateToken,
  validateChain,
  sanitizeString,
  validateMemo,
  
  // Verification
  isNonceUsed,
  markNonceUsed,
  getNonceStats,
  verifyPaymentProof,
  registerFacilitator,
  isTrustedFacilitator,
  getRegisteredFacilitators,
  verifyFacilitatorSignature,
  verifyAuthorizationTiming,
  isValidTxHash,
  generatePaymentId,
  storeReceipt,
  getReceipt,
  isPaymentVerified,
} from "./x402/index.js"

// ============================================================
// x402 Type Exports
// ============================================================
export type {
  X402ClientConfig,
  X402Chain,
  X402SvmChain,
  X402Token,
  PaymentResult,
  HTTP402Response,
  YieldInfo,
} from "./x402/index.js"

export type {
  X402Config,
  X402Network,
  NetworkConfig,
  TokenConfig,
} from "./x402/index.js"

export type {
  CreateX402ClientOptions,
  X402ClientWrapper,
  ClientEvmSigner,
  ClientSvmSigner,
} from "./x402/index.js"

export type {
  SecurityEvent,
  SecurityEventType,
  ExternalSigner,
  PaymentLimits,
  PaymentValidationResult,
  URLValidationOptions,
  URLValidationResult,
  AmountValidationResult,
  AddressValidationResult,
  PaymentProof,
  ProofVerificationResult,
  EIP3009Authorization,
  PaymentReceipt,
} from "./x402/index.js"

// ============================================================
// Tool Marketplace Exports
// ============================================================
export {
  // Main registration
  registerToolMarketplace,
  
  // Registry service
  toolRegistry,
  ToolRegistryService,
  
  // Client for calling paid tools
  MarketplaceClient,
  createMarketplaceClient,
  
  // Revenue distribution
  revenueSplitter,
  RevenueSplitterService,
} from "./modules/tool-marketplace/index.js"

export type {
  // Core types
  RevenueSplit,
  PricingModel,
  SubscriptionTier,
  TieredPricing,
  ToolPricing,
  ToolCategory,
  ToolStatus,
  ToolMetadata,
  RegisterToolInput,
  RegisteredTool,
  ToolDiscoveryFilter,
  ToolUsageRecord,
  ToolRevenue,
  CreatorAnalytics,
  SubscriptionStatus,
  MarketplaceStats,
  MarketplaceEventType,
  MarketplaceEvent,
  PayoutConfig,
  
  // Client types
  CallToolOptions,
  CallToolResult,
  
  // Revenue types
  PayoutRecord,
  PendingPayout,
  RevenueDistribution,
} from "./modules/tool-marketplace/index.js"

// ============================================================
// MCP Types
// ============================================================
export type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
