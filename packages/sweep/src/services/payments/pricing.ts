/**
 * API Pricing Service
 *
 * Defines pricing for all API endpoints.
 * Prices are in cents (USD).
 */

// Pricing for API endpoints (in cents)
export const API_PRICING: Record<string, number> = {
  // Free endpoints
  "GET /wallet/:address/dust": 0,
  "GET /wallet/:address/balances": 0,
  "GET /health": 0,
  "GET /health/live": 0,
  "GET /health/ready": 0,
  "GET /metrics": 0,
  "GET /payments/pricing": 0,
  "GET /payments/balance": 0,

  // Paid endpoints
  "POST /quote": 5, // $0.05
  "POST /api/quote": 5, // $0.05
  "POST /sweep": 10, // $0.10
  "POST /api/sweep": 10, // $0.10
  "POST /api/sweep/quote": 5, // $0.05
  "POST /api/sweep/execute": 10, // $0.10
  "POST /consolidate/execute": 25, // $0.25
  "GET /defi/positions": 5, // $0.05
  "GET /api/defi/positions": 5, // $0.05
  "POST /defi/deposit": 15, // $0.15
  "POST /api/defi/deposit": 15, // $0.15
  "POST /api/defi/route": 10, // $0.10
  "POST /api/defi/multi-route": 15, // $0.15
  "GET /api/bridge/quote": 5, // $0.05
  "POST /api/bridge/execute": 20, // $0.20
};

// Endpoint categories for display
export const ENDPOINT_CATEGORIES: Record<string, string[]> = {
  "Free Endpoints": [
    "GET /wallet/:address/dust",
    "GET /wallet/:address/balances",
    "GET /health",
    "GET /payments/pricing",
    "GET /payments/balance",
  ],
  "Wallet Operations": [
    "POST /quote",
    "POST /sweep",
    "POST /consolidate/execute",
  ],
  "DeFi Operations": [
    "GET /defi/positions",
    "POST /defi/deposit",
  ],
  "Bridge Operations": [
    "GET /api/bridge/quote",
    "POST /api/bridge/execute",
  ],
};

// Rate limits per tier (requests per minute)
export const RATE_LIMITS = {
  free: 10, // 10 requests per minute
  paid: 100, // 100 requests per minute for paying users
  premium: 1000, // 1000 requests per minute for premium
};

// Free tier daily limits
export const FREE_TIER_DAILY_LIMITS = {
  total: 10, // 10 free requests per day
  perEndpoint: 5, // 5 free requests per endpoint per day
};

// Discount tiers based on monthly spend (in cents)
export const DISCOUNT_TIERS = [
  { minSpendCents: 0, discount: 0 }, // No discount
  { minSpendCents: 10000, discount: 0.05 }, // $100+ = 5% discount
  { minSpendCents: 50000, discount: 0.10 }, // $500+ = 10% discount
  { minSpendCents: 100000, discount: 0.15 }, // $1000+ = 15% discount
  { minSpendCents: 500000, discount: 0.20 }, // $5000+ = 20% discount
];

/**
 * Get price for an endpoint
 */
export function getEndpointPrice(method: string, path: string): number {
  // Normalize the endpoint
  const normalizedPath = normalizePath(path);
  const endpoint = `${method.toUpperCase()} ${normalizedPath}`;

  // Check exact match
  if (API_PRICING[endpoint] !== undefined) {
    return API_PRICING[endpoint];
  }

  // Check with /api prefix
  const withApiPrefix = `${method.toUpperCase()} /api${normalizedPath}`;
  if (API_PRICING[withApiPrefix] !== undefined) {
    return API_PRICING[withApiPrefix];
  }

  // Check without /api prefix
  if (normalizedPath.startsWith("/api/")) {
    const withoutApiPrefix = `${method.toUpperCase()} ${normalizedPath.slice(4)}`;
    if (API_PRICING[withoutApiPrefix] !== undefined) {
      return API_PRICING[withoutApiPrefix];
    }
  }

  // Check pattern matches
  for (const [pattern, price] of Object.entries(API_PRICING)) {
    if (matchEndpointPattern(endpoint, pattern)) {
      return price;
    }
  }

  // Default: free for unknown endpoints
  return 0;
}

/**
 * Normalize a path by removing query strings and replacing dynamic segments
 */
function normalizePath(path: string): string {
  // Remove query string
  const withoutQuery = path.split("?")[0];

  // Replace common dynamic segments
  return withoutQuery
    .replace(/0x[a-fA-F0-9]{40}/g, ":address") // Ethereum addresses
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, ":uuid") // UUIDs
    .replace(/\d+/g, ":id"); // Numbers
}

/**
 * Match an endpoint against a pattern with wildcards
 */
function matchEndpointPattern(endpoint: string, pattern: string): boolean {
  // Split into method and path
  const [endpointMethod, endpointPath] = endpoint.split(" ");
  const [patternMethod, patternPath] = pattern.split(" ");

  // Method must match
  if (endpointMethod !== patternMethod) {
    return false;
  }

  // Split paths into segments
  const endpointSegments = endpointPath.split("/").filter(Boolean);
  const patternSegments = patternPath.split("/").filter(Boolean);

  // Must have same number of segments
  if (endpointSegments.length !== patternSegments.length) {
    return false;
  }

  // Match each segment
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSeg = patternSegments[i];
    const endpointSeg = endpointSegments[i];

    // Pattern segment is a wildcard
    if (patternSeg.startsWith(":")) {
      continue;
    }

    // Exact match required
    if (patternSeg !== endpointSeg) {
      return false;
    }
  }

  return true;
}

/**
 * Get all pricing information
 */
export function getAllPricing(): {
  endpoints: Record<string, { priceCents: number; priceUsd: string }>;
  categories: Record<string, { endpoint: string; priceCents: number; priceUsd: string }[]>;
  rateLimits: typeof RATE_LIMITS;
  freeTier: typeof FREE_TIER_DAILY_LIMITS;
  discounts: typeof DISCOUNT_TIERS;
} {
  const endpoints: Record<string, { priceCents: number; priceUsd: string }> = {};

  for (const [endpoint, priceCents] of Object.entries(API_PRICING)) {
    endpoints[endpoint] = {
      priceCents,
      priceUsd: (priceCents / 100).toFixed(2),
    };
  }

  const categories: Record<string, { endpoint: string; priceCents: number; priceUsd: string }[]> = {};

  for (const [category, categoryEndpoints] of Object.entries(ENDPOINT_CATEGORIES)) {
    categories[category] = categoryEndpoints.map((endpoint) => ({
      endpoint,
      priceCents: API_PRICING[endpoint] || 0,
      priceUsd: ((API_PRICING[endpoint] || 0) / 100).toFixed(2),
    }));
  }

  return {
    endpoints,
    categories,
    rateLimits: RATE_LIMITS,
    freeTier: FREE_TIER_DAILY_LIMITS,
    discounts: DISCOUNT_TIERS,
  };
}

/**
 * Calculate discount for a user based on monthly spend
 */
export function calculateDiscount(monthlySpendCents: number): number {
  for (let i = DISCOUNT_TIERS.length - 1; i >= 0; i--) {
    if (monthlySpendCents >= DISCOUNT_TIERS[i].minSpendCents) {
      return DISCOUNT_TIERS[i].discount;
    }
  }
  return 0;
}

/**
 * Apply discount to a price
 */
export function applyDiscount(priceCents: number, discount: number): number {
  return Math.round(priceCents * (1 - discount));
}

/**
 * Check if an endpoint is free
 */
export function isEndpointFree(method: string, path: string): boolean {
  return getEndpointPrice(method, path) === 0;
}

/**
 * Get pricing summary for display
 */
export function getPricingSummary(): {
  cheapest: { endpoint: string; priceUsd: string };
  mostExpensive: { endpoint: string; priceUsd: string };
  averagePrice: string;
  freeEndpointsCount: number;
  paidEndpointsCount: number;
} {
  const prices = Object.entries(API_PRICING);
  const paidPrices = prices.filter(([, price]) => price > 0);
  const freePrices = prices.filter(([, price]) => price === 0);

  const cheapest = paidPrices.reduce(
    (min, [endpoint, price]) => (price < min.price ? { endpoint, price } : min),
    { endpoint: "", price: Infinity }
  );

  const mostExpensive = prices.reduce(
    (max, [endpoint, price]) => (price > max.price ? { endpoint, price } : max),
    { endpoint: "", price: 0 }
  );

  const average =
    paidPrices.length > 0
      ? paidPrices.reduce((sum, [, price]) => sum + price, 0) / paidPrices.length
      : 0;

  return {
    cheapest: {
      endpoint: cheapest.endpoint,
      priceUsd: (cheapest.price / 100).toFixed(2),
    },
    mostExpensive: {
      endpoint: mostExpensive.endpoint,
      priceUsd: (mostExpensive.price / 100).toFixed(2),
    },
    averagePrice: (average / 100).toFixed(2),
    freeEndpointsCount: freePrices.length,
    paidEndpointsCount: paidPrices.length,
  };
}
