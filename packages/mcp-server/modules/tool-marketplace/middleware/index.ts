/**
 * Middleware Module Exports
 * @description Barrel exports for marketplace middleware
 * @author nirholas
 * @license Apache-2.0
 */

export {
  createExpressMiddleware,
  fastifyMarketplaceAuth,
  authenticateRequest,
  extractApiKey,
  createKeyValidator,
  type MarketplaceAuthOptions,
  type AuthResult,
  type AuthError,
  type MarketplaceRequest,
  type MiddlewareResult,
} from "./auth.js"
