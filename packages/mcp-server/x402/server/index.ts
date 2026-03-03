/**
 * @fileoverview X402 Server Module
 * @description Main entry point for x402 server-side payment infrastructure
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * This module provides everything needed to RECEIVE x402 payments:
 * - Middleware for Express, Fastify, Hono, and Koa
 * - Payment verification with replay protection
 * - Facilitator integration (Coinbase or self-hosted)
 * - Dynamic pricing strategies
 * - Analytics and reporting
 * - MCP tools for AI agents
 * 
 * @example Express Server
 * ```typescript
 * import express from 'express';
 * import { x402Paywall } from '@/x402/server';
 * 
 * const app = express();
 * 
 * app.get('/premium', x402Paywall({
 *   price: '0.01',
 *   token: 'USDs',
 *   network: 'arbitrum',
 *   description: 'Premium content'
 * }), (req, res) => {
 *   res.json({ data: 'Premium content!' });
 * });
 * ```
 * 
 * @example MCP Integration
 * ```typescript
 * import { registerX402ServerTools } from '@/x402/server';
 * 
 * // Register server tools with MCP server
 * registerX402ServerTools(mcpServer);
 * ```
 * 
 * @example Dynamic Pricing
 * ```typescript
 * import { dynamicPrice, x402DynamicPaywall } from '@/x402/server';
 * 
 * const pricing = dynamicPrice({
 *   base: '0.001',
 *   perToken: '0.0001',
 *   surge: (ctx) => isPeakHour() ? 1.5 : 1.0,
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * 
 * app.post('/ai/generate', x402DynamicPaywall(pricing, {...}), handler);
 * ```
 */

// ============================================================================
// Middleware
// ============================================================================

export {
  // Main middleware
  x402Paywall,
  x402DynamicPaywall,
  
  // Framework adapters
  x402PaywallFastify,
  x402PaywallHono,
  x402PaywallKoa,
  
  // Utility middleware
  x402ExtractPayment,
  x402TrackPayment,
  x402RateLimit,
} from './middleware.js';

// ============================================================================
// Payment Verification
// ============================================================================

export {
  // Main verifier
  X402PaymentVerifier,
  
  // Nonce store for replay protection
  InMemoryNonceStore,
  
  // Factory functions
  createVerifier,
  createMultiChainVerifier,
  createVerifierWithSharedStore,
  
  // Types
  type VerifierConfig,
} from './verifier.js';

// ============================================================================
// Facilitator
// ============================================================================

export {
  // Main facilitator client
  X402Facilitator,
  
  // Factory functions
  createCoinbaseFacilitator,
  createSelfHostedFacilitator,
  createFacilitatorFromEnv,
} from './facilitator.js';

// ============================================================================
// Pricing
// ============================================================================

export {
  // Price calculators
  dynamicPrice,
  fixedPrice,
  tieredPrice,
  timeBasedPrice,
  resourceBasedPrice,
  compositePrice,
  
  // Context helpers
  createPricingContext,
  
  // Types
  type PriceTier,
  type TieredPricingOptions,
  type TimeBasedPricingOptions,
  type ResourcePricing,
  type ResourceBasedPricingOptions,
} from './pricing.js';

// ============================================================================
// Analytics
// ============================================================================

export {
  // Main analytics class
  X402Analytics,
  
  // Storage implementations
  InMemoryAnalyticsStorage,
  JsonFileAnalyticsStorage,
  
  // Factory functions
  createFileAnalytics,
  createMemoryAnalytics,
  
  // Types
  type AnalyticsStorage,
  type AnalyticsConfig,
} from './analytics.js';

// ============================================================================
// Configuration
// ============================================================================

export {
  loadX402ServerConfig,
  isX402ServerConfigured,
  validateX402ServerConfig,
  clearX402ServerConfigCache,
  setX402ServerConfig,
  getSafeConfigForLogging,
  logX402ServerConfig,
} from './config.js';

// ============================================================================
// MCP Tools
// ============================================================================

export {
  registerX402ServerTools,
  getProtectedEndpoints,
  registerProtectedEndpoint,
} from './tools.js';

// ============================================================================
// Types
// ============================================================================

export type {
  // Request/Response types
  GenericRequest,
  GenericResponse,
  NextFunction,
  MiddlewareHandler,
  
  // Paywall types
  PaywallOptions,
  
  // Facilitator types
  FacilitatorType,
  FacilitatorConfig,
  SettlementRequest,
  SettlementResult,
  PaymentQueryOptions,
  FacilitatorBalance,
  
  // Verifier types
  VerificationRequest,
  VerificationResult,
  NonceStore,
  
  // Pricing types
  PricingContext,
  DynamicPricingOptions,
  PriceResult,
  PriceCalculator,
  
  // Analytics types
  PaymentRecord,
  RevenueSummary,
  EndpointRevenue,
  TopPayer,
  AnalyticsQueryOptions,
  ExportOptions,
  ExportFormat,
  
  // Server config types
  X402ServerConfig,
  ProtectedEndpoint,
  EarningsInfo,
} from './types.js';
