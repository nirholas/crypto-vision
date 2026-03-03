/**
 * @fileoverview X402 Dynamic Pricing
 * @description Flexible pricing strategies for x402 paywalls
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * @example Fixed Price
 * ```typescript
 * const calculator = fixedPrice('0.01', 'USDs', 'arbitrum');
 * ```
 * 
 * @example Dynamic Price with Per-Token Billing
 * ```typescript
 * const calculator = dynamicPrice({
 *   base: '0.001',
 *   perToken: '0.0001', // For AI token usage
 *   surge: (ctx) => ctx.metadata?.isPeakHour ? 1.5 : 1.0,
 *   discount: (ctx) => ctx.metadata?.isPremiumUser ? 0.8 : 1.0,
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * ```
 * 
 * @example Tiered Pricing
 * ```typescript
 * const calculator = tieredPrice({
 *   tiers: [
 *     { maxRequests: 10, price: '0.001' },
 *     { maxRequests: 100, price: '0.0008' },
 *     { price: '0.0005' } // Unlimited
 *   ],
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * ```
 */

import type { Address } from 'viem';
import type { X402Chain, X402Token } from '../sdk/types.js';
import type {
  PricingContext,
  DynamicPricingOptions,
  PriceResult,
  PriceCalculator,
  GenericRequest,
} from './types.js';
import Logger from '@/utils/logger.js';

// ============================================================================
// Dynamic Price Calculator
// ============================================================================

/**
 * Create a dynamic price calculator
 * 
 * @example
 * ```typescript
 * const calculator = dynamicPrice({
 *   base: '0.01',
 *   perToken: '0.0001',  // $0.0001 per AI token
 *   perKB: '0.001',      // $0.001 per KB response
 *   surge: async (ctx) => {
 *     // 1.5x during peak hours
 *     const hour = new Date().getHours();
 *     return (hour >= 9 && hour <= 17) ? 1.5 : 1.0;
 *   },
 *   discount: async (ctx) => {
 *     // 20% off for verified addresses
 *     if (ctx.clientAddress && await isVerified(ctx.clientAddress)) {
 *       return 0.8;
 *     }
 *     return 1.0;
 *   },
 *   minPrice: '0.001',
 *   maxPrice: '1.00',
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * ```
 */
export function dynamicPrice(options: DynamicPricingOptions): PriceCalculator {
  const {
    base,
    perToken,
    perKB,
    perSecond,
    surge,
    discount,
    minPrice,
    maxPrice,
    token,
    network,
  } = options;

  return {
    async calculate(ctx: PricingContext): Promise<PriceResult> {
      const breakdown: string[] = [];
      let totalPrice = 0;

      // Base price
      const basePrice = parseFloat(base);
      totalPrice += basePrice;
      breakdown.push(`Base: $${base}`);

      // Per-token pricing (for AI/LLM endpoints)
      let tokenPrice: string | undefined;
      if (perToken && ctx.metadata?.tokens) {
        const tokens = Number(ctx.metadata.tokens);
        const tokenCost = tokens * parseFloat(perToken);
        totalPrice += tokenCost;
        tokenPrice = tokenCost.toFixed(6);
        breakdown.push(`Tokens (${tokens}): $${tokenPrice}`);
      }

      // Per-KB pricing
      let sizePrice: string | undefined;
      if (perKB && ctx.metadata?.responseSize) {
        const sizeKB = Number(ctx.metadata.responseSize) / 1024;
        const sizeCost = sizeKB * parseFloat(perKB);
        totalPrice += sizeCost;
        sizePrice = sizeCost.toFixed(6);
        breakdown.push(`Size (${sizeKB.toFixed(2)}KB): $${sizePrice}`);
      }

      // Per-second compute pricing
      let computePrice: string | undefined;
      if (perSecond && ctx.metadata?.computeSeconds) {
        const seconds = Number(ctx.metadata.computeSeconds);
        const computeCost = seconds * parseFloat(perSecond);
        totalPrice += computeCost;
        computePrice = computeCost.toFixed(6);
        breakdown.push(`Compute (${seconds}s): $${computePrice}`);
      }

      // Apply surge multiplier
      let surgeMultiplier = 1.0;
      if (surge) {
        try {
          surgeMultiplier = await surge(ctx);
          if (surgeMultiplier !== 1.0) {
            totalPrice *= surgeMultiplier;
            breakdown.push(`Surge: ${surgeMultiplier}x`);
          }
        } catch (error) {
          Logger.warn(`x402: Surge calculation failed: ${error}`);
        }
      }

      // Apply discount
      let discountMultiplier = 1.0;
      if (discount) {
        try {
          discountMultiplier = await discount(ctx);
          if (discountMultiplier !== 1.0) {
            totalPrice *= discountMultiplier;
            breakdown.push(`Discount: ${((1 - discountMultiplier) * 100).toFixed(0)}% off`);
          }
        } catch (error) {
          Logger.warn(`x402: Discount calculation failed: ${error}`);
        }
      }

      // Apply min/max bounds
      if (minPrice) {
        const min = parseFloat(minPrice);
        if (totalPrice < min) {
          totalPrice = min;
          breakdown.push(`Min price applied: $${minPrice}`);
        }
      }
      if (maxPrice) {
        const max = parseFloat(maxPrice);
        if (totalPrice > max) {
          totalPrice = max;
          breakdown.push(`Max price applied: $${maxPrice}`);
        }
      }

      return {
        price: totalPrice.toFixed(6),
        basePrice: base,
        tokenPrice,
        sizePrice,
        computePrice,
        surgeMultiplier: surgeMultiplier !== 1.0 ? surgeMultiplier : undefined,
        discountMultiplier: discountMultiplier !== 1.0 ? discountMultiplier : undefined,
        token,
        network,
        breakdown: breakdown.join(' | '),
      };
    },

    getConfig(): DynamicPricingOptions {
      return { ...options };
    },
  };
}

// ============================================================================
// Fixed Price Calculator
// ============================================================================

/**
 * Create a simple fixed price calculator
 * 
 * @example
 * ```typescript
 * const calculator = fixedPrice('0.01', 'USDs', 'arbitrum');
 * ```
 */
export function fixedPrice(
  price: string,
  token: X402Token,
  network: X402Chain
): PriceCalculator {
  return {
    async calculate(_ctx: PricingContext): Promise<PriceResult> {
      return {
        price,
        basePrice: price,
        token,
        network,
        breakdown: `Fixed: $${price}`,
      };
    },

    getConfig(): DynamicPricingOptions {
      return { base: price, token, network };
    },
  };
}

// ============================================================================
// Tiered Pricing
// ============================================================================

/**
 * Tier configuration
 */
export interface PriceTier {
  /** Maximum requests for this tier (undefined = unlimited) */
  maxRequests?: number;
  /** Price per request at this tier */
  price: string;
  /** Tier name */
  name?: string;
}

/**
 * Tiered pricing options
 */
export interface TieredPricingOptions {
  /** Price tiers (ordered from smallest to largest) */
  tiers: PriceTier[];
  /** Token for pricing */
  token: X402Token;
  /** Network */
  network: X402Chain;
  /** Function to get current request count for client */
  getRequestCount?: (ctx: PricingContext) => number | Promise<number>;
  /** Period for counting requests (default: 'day') */
  countPeriod?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Create tiered price calculator
 * Price decreases as usage increases
 * 
 * @example
 * ```typescript
 * const calculator = tieredPrice({
 *   tiers: [
 *     { maxRequests: 100, price: '0.01', name: 'Basic' },
 *     { maxRequests: 1000, price: '0.008', name: 'Standard' },
 *     { maxRequests: 10000, price: '0.005', name: 'Pro' },
 *     { price: '0.002', name: 'Enterprise' }  // Unlimited
 *   ],
 *   token: 'USDs',
 *   network: 'arbitrum',
 *   getRequestCount: async (ctx) => {
 *     return await db.getRequestCount(ctx.clientAddress, 'month');
 *   }
 * });
 * ```
 */
export function tieredPrice(options: TieredPricingOptions): PriceCalculator {
  const { tiers, token, network, getRequestCount, countPeriod = 'day' } = options;

  // Validate tiers are properly ordered
  const sortedTiers = [...tiers].sort((a, b) => {
    if (a.maxRequests === undefined) return 1;
    if (b.maxRequests === undefined) return -1;
    return a.maxRequests - b.maxRequests;
  });

  return {
    async calculate(ctx: PricingContext): Promise<PriceResult> {
      let requestCount = 0;
      
      if (getRequestCount) {
        requestCount = await getRequestCount(ctx);
      } else if (ctx.metadata?.requestCount !== undefined) {
        requestCount = Number(ctx.metadata.requestCount);
      }

      // Find appropriate tier
      let selectedTier = sortedTiers[sortedTiers.length - 1]!;
      for (const tier of sortedTiers) {
        if (tier.maxRequests === undefined || requestCount < tier.maxRequests) {
          selectedTier = tier;
          break;
        }
      }

      const tierName = selectedTier.name || 
        (selectedTier.maxRequests ? `Up to ${selectedTier.maxRequests}` : 'Unlimited');

      return {
        price: selectedTier.price,
        basePrice: selectedTier.price,
        token,
        network,
        breakdown: `Tier: ${tierName} ($${selectedTier.price}/req) | Requests this ${countPeriod}: ${requestCount}`,
      };
    },

    getConfig(): DynamicPricingOptions {
      return {
        base: tiers[0]?.price || '0',
        token,
        network,
      };
    },
  };
}

// ============================================================================
// Time-Based Pricing
// ============================================================================

/**
 * Time-based pricing options
 */
export interface TimeBasedPricingOptions {
  /** Default price */
  defaultPrice: string;
  /** Peak hours pricing (higher) */
  peakPrice?: string;
  /** Off-peak hours pricing (lower) */
  offPeakPrice?: string;
  /** Peak hours (24-hour format) */
  peakHours?: { start: number; end: number };
  /** Off-peak hours (24-hour format) */
  offPeakHours?: { start: number; end: number };
  /** Weekend pricing multiplier */
  weekendMultiplier?: number;
  /** Token */
  token: X402Token;
  /** Network */
  network: X402Chain;
  /** Timezone (default: 'UTC') */
  timezone?: string;
}

/**
 * Create time-based price calculator
 * Prices vary based on time of day, day of week
 * 
 * @example
 * ```typescript
 * const calculator = timeBasedPrice({
 *   defaultPrice: '0.01',
 *   peakPrice: '0.015',      // 50% more during peak
 *   offPeakPrice: '0.005',   // 50% less during off-peak
 *   peakHours: { start: 9, end: 17 },     // 9am-5pm
 *   offPeakHours: { start: 0, end: 6 },   // Midnight-6am
 *   weekendMultiplier: 0.8,  // 20% off on weekends
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * ```
 */
export function timeBasedPrice(options: TimeBasedPricingOptions): PriceCalculator {
  const {
    defaultPrice,
    peakPrice,
    offPeakPrice,
    peakHours,
    offPeakHours,
    weekendMultiplier,
    token,
    network,
    timezone = 'UTC',
  } = options;

  return {
    async calculate(_ctx: PricingContext): Promise<PriceResult> {
      const now = new Date();
      const breakdown: string[] = [];
      
      // Get current hour (simplified - doesn't handle timezone properly)
      const hour = now.getUTCHours();
      const dayOfWeek = now.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Determine base price based on time
      let price = parseFloat(defaultPrice);
      let priceReason = 'Standard';

      if (peakHours && peakPrice) {
        if (hour >= peakHours.start && hour < peakHours.end) {
          price = parseFloat(peakPrice);
          priceReason = `Peak (${peakHours.start}:00-${peakHours.end}:00)`;
        }
      }

      if (offPeakHours && offPeakPrice) {
        if (hour >= offPeakHours.start && hour < offPeakHours.end) {
          price = parseFloat(offPeakPrice);
          priceReason = `Off-Peak (${offPeakHours.start}:00-${offPeakHours.end}:00)`;
        }
      }

      breakdown.push(priceReason);

      // Apply weekend multiplier
      if (isWeekend && weekendMultiplier !== undefined) {
        price *= weekendMultiplier;
        breakdown.push(`Weekend: ${weekendMultiplier}x`);
      }

      return {
        price: price.toFixed(6),
        basePrice: defaultPrice,
        surgeMultiplier: price / parseFloat(defaultPrice),
        token,
        network,
        breakdown: breakdown.join(' | '),
      };
    },

    getConfig(): DynamicPricingOptions {
      return { base: defaultPrice, token, network };
    },
  };
}

// ============================================================================
// Resource-Based Pricing
// ============================================================================

/**
 * Resource pricing map
 */
export interface ResourcePricing {
  /** Path pattern (supports wildcards) */
  pattern: string;
  /** Price for this resource */
  price: string;
  /** Description */
  description?: string;
}

/**
 * Resource-based pricing options
 */
export interface ResourceBasedPricingOptions {
  /** Default price for unmatched resources */
  defaultPrice: string;
  /** Resource-specific pricing */
  resources: ResourcePricing[];
  /** Token */
  token: X402Token;
  /** Network */
  network: X402Chain;
}

/**
 * Create resource-based price calculator
 * Different prices for different endpoints
 * 
 * @example
 * ```typescript
 * const calculator = resourceBasedPrice({
 *   defaultPrice: '0.01',
 *   resources: [
 *     { pattern: '/api/joke', price: '0.001', description: 'Random joke' },
 *     { pattern: '/api/summary', price: '0.01', description: 'Text summary' },
 *     { pattern: '/api/image/*', price: '0.05', description: 'Image generation' },
 *     { pattern: '/api/premium/*', price: '0.10', description: 'Premium features' },
 *   ],
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * ```
 */
export function resourceBasedPrice(options: ResourceBasedPricingOptions): PriceCalculator {
  const { defaultPrice, resources, token, network } = options;

  return {
    async calculate(ctx: PricingContext): Promise<PriceResult> {
      const resource = ctx.resource || '/';
      
      // Find matching resource pricing
      for (const r of resources) {
        if (matchPattern(resource, r.pattern)) {
          return {
            price: r.price,
            basePrice: r.price,
            token,
            network,
            breakdown: `${r.description || r.pattern}: $${r.price}`,
          };
        }
      }

      return {
        price: defaultPrice,
        basePrice: defaultPrice,
        token,
        network,
        breakdown: `Default: $${defaultPrice}`,
      };
    },

    getConfig(): DynamicPricingOptions {
      return { base: defaultPrice, token, network };
    },
  };
}

/**
 * Simple pattern matching (supports * wildcard)
 */
function matchPattern(path: string, pattern: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
    .replace(/\*/g, '.*');  // Convert * to .*
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

// ============================================================================
// Composite Pricing
// ============================================================================

/**
 * Combine multiple calculators with custom logic
 * 
 * @example
 * ```typescript
 * const calculator = compositePrice([
 *   resourceBasedPrice({ ... }),
 *   timeBasedPrice({ ... }),
 * ], {
 *   combine: 'multiply',  // or 'add', 'max', 'min', 'average'
 *   token: 'USDs',
 *   network: 'arbitrum'
 * });
 * ```
 */
export function compositePrice(
  calculators: PriceCalculator[],
  options: {
    combine: 'add' | 'multiply' | 'max' | 'min' | 'average';
    token: X402Token;
    network: X402Chain;
    minPrice?: string;
    maxPrice?: string;
  }
): PriceCalculator {
  const { combine, token, network, minPrice, maxPrice } = options;

  return {
    async calculate(ctx: PricingContext): Promise<PriceResult> {
      const results = await Promise.all(calculators.map(c => c.calculate(ctx)));
      const prices = results.map(r => parseFloat(r.price));
      
      let finalPrice: number;
      
      switch (combine) {
        case 'add':
          finalPrice = prices.reduce((a, b) => a + b, 0);
          break;
        case 'multiply':
          finalPrice = prices.reduce((a, b) => a * b, 1);
          break;
        case 'max':
          finalPrice = Math.max(...prices);
          break;
        case 'min':
          finalPrice = Math.min(...prices);
          break;
        case 'average':
          finalPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
          break;
      }

      // Apply bounds
      if (minPrice) finalPrice = Math.max(finalPrice, parseFloat(minPrice));
      if (maxPrice) finalPrice = Math.min(finalPrice, parseFloat(maxPrice));

      return {
        price: finalPrice.toFixed(6),
        basePrice: results[0]?.basePrice || '0',
        token,
        network,
        breakdown: `Composite (${combine}): ` + results.map(r => r.breakdown).join(' + '),
      };
    },

    getConfig(): DynamicPricingOptions {
      return {
        base: calculators[0]?.getConfig().base || '0',
        token,
        network,
      };
    },
  };
}

// ============================================================================
// Pricing Context Helpers
// ============================================================================

/**
 * Create pricing context from Express request
 */
export function createPricingContext(
  req: GenericRequest,
  options?: {
    clientAddress?: Address;
    metadata?: Record<string, unknown>;
  }
): PricingContext {
  return {
    request: req,
    resource: req.path || req.originalUrl || req.url || '/',
    clientIp: getClientIp(req),
    clientAddress: options?.clientAddress || getHeader(req, 'x-payment-address') as Address | undefined,
    metadata: {
      method: req.method,
      query: req.query,
      bodySize: typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body || {}).length,
      ...options?.metadata,
    },
  };
}

/**
 * Helper to get header value
 */
function getHeader(req: GenericRequest, name: string): string | undefined {
  const value = req.headers[name] ?? req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Helper to get client IP
 */
function getClientIp(req: GenericRequest): string | undefined {
  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim();
  return getHeader(req, 'x-real-ip');
}
