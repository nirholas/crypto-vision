/**
 * Crypto Data Aggregator SDK v2
 *
 * Works in Node.js and browsers.
 * Supports all v2 API endpoints with TypeScript-like JSDoc types.
 *
 * @version 2.0.0
 * 
 * Usage:
 *   import { CryptoAPI } from './crypto-api-v2.js';
 *
 *   // With API key
 *   const api = new CryptoAPI({ apiKey: 'cda_xxx...' });
 *
 *   // Get market data
 *   const coins = await api.getCoins({ page: 1, perPage: 50 });
 *   const btc = await api.getCoin('bitcoin');
 *   const trending = await api.getTrending();
 * 
 *   // GraphQL query
 *   const result = await api.graphql(`{
 *     coins(page: 1) { coins { id name price } }
 *   }`);
 */

const DEFAULT_BASE_URL = 'https://crypto-data-aggregator.vercel.app';
const API_VERSION = 'v2';

/**
 * @typedef {Object} CoinMarket
 * @property {string} id
 * @property {string} symbol
 * @property {string} name
 * @property {number} price
 * @property {number} marketCap
 * @property {number} rank
 * @property {number} volume24h
 * @property {number} [priceChange24h]
 * @property {number} [priceChangePercent24h]
 */

/**
 * @typedef {Object} GlobalData
 * @property {number} totalMarketCap
 * @property {number} totalVolume24h
 * @property {number} btcDominance
 * @property {number} ethDominance
 */

/**
 * @typedef {Object} RateLimitInfo
 * @property {number} remaining
 * @property {number} limit
 * @property {number} resetAt
 */

export class CryptoAPIError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.name = 'CryptoAPIError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class RateLimitError extends CryptoAPIError {
  constructor(retryAfter) {
    super('Rate limit exceeded', 'RATE_LIMITED', 429);
    this.retryAfter = retryAfter;
  }
}

export class PaymentRequiredError extends CryptoAPIError {
  constructor(paymentInfo) {
    super('Payment required', 'PAYMENT_REQUIRED', 402);
    this.paymentInfo = paymentInfo;
  }
}

export class CryptoAPI {
  /**
   * Create a new CryptoAPI client
   * @param {Object} options Configuration options
   * @param {string} [options.baseUrl] Custom API URL
   * @param {string} options.apiKey API key for authenticated requests
   * @param {number} [options.timeout] Request timeout in ms (default: 30000)
   * @param {boolean} [options.useV1Fallback] Fall back to v1 on v2 errors
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 30000;
    this.useV1Fallback = options.useV1Fallback || false;
    /** @type {RateLimitInfo | null} */
    this.lastRateLimit = null;
  }

  /**
   * Set API key
   * @param {string} apiKey
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Get rate limit info from last request
   * @returns {RateLimitInfo | null}
   */
  getRateLimitInfo() {
    return this.lastRateLimit;
  }

  /**
   * @private
   */
  async _fetch(endpoint, options = {}) {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'CryptoAPI-SDK/2.0',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    if (options.payment) {
      headers['X-PAYMENT'] = options.payment;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.baseUrl}/api/${API_VERSION}${endpoint}`;
      
      const fetchOptions = {
        method: options.method || 'GET',
        headers,
        signal: controller.signal,
      };

      if (options.body) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Parse rate limit headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const limit = response.headers.get('X-RateLimit-Limit');
      const resetAt = response.headers.get('X-RateLimit-Reset');
      if (remaining && limit) {
        this.lastRateLimit = {
          remaining: parseInt(remaining),
          limit: parseInt(limit),
          resetAt: resetAt ? parseInt(resetAt) * 1000 : Date.now() + 86400000,
        };
      }

      // Handle error responses
      if (response.status === 402) {
        throw new PaymentRequiredError(response.headers.get('X-Payment-Required'));
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        throw new RateLimitError(retryAfter);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new CryptoAPIError(
          data.error || 'Request failed',
          data.code || 'UNKNOWN_ERROR',
          response.status,
          data.details
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new CryptoAPIError('Request timeout', 'TIMEOUT', 0);
      }
      
      throw error;
    }
  }

  /**
   * Build query string from params object
   * @private
   */
  _buildQuery(params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        query.set(key, String(value));
      }
    }
    const str = query.toString();
    return str ? `?${str}` : '';
  }

  // ===========================================================================
  // MARKET DATA
  // ===========================================================================

  /**
   * Get list of coins with market data
   * @param {Object} [options]
   * @param {number} [options.page=1] Page number
   * @param {number} [options.perPage=100] Results per page (max 250)
   * @param {string} [options.order='market_cap_desc'] Sort order
   * @param {string} [options.ids] Comma-separated coin IDs
   * @param {boolean} [options.sparkline] Include 7-day sparkline
   * @returns {Promise<{success: boolean, data: CoinMarket[]}>}
   */
  async getCoins(options = {}) {
    const query = this._buildQuery({
      page: options.page,
      per_page: options.perPage,
      order: options.order,
      ids: options.ids,
      sparkline: options.sparkline,
    });
    return this._fetch(`/coins${query}`);
  }

  /**
   * Get detailed info for a specific coin
   * @param {string} id Coin ID (e.g., 'bitcoin', 'ethereum')
   * @returns {Promise<{success: boolean, data: Object}>}
   */
  async getCoin(id) {
    return this._fetch(`/coin/${encodeURIComponent(id)}`);
  }

  /**
   * Get global market data
   * @returns {Promise<{success: boolean, data: GlobalData}>}
   */
  async getGlobal() {
    return this._fetch('/global');
  }

  /**
   * Get real-time ticker data
   * @param {Object} [options]
   * @param {string} [options.symbol] Single symbol (e.g., 'BTC')
   * @param {string} [options.symbols] Comma-separated symbols
   * @returns {Promise<Object>}
   */
  async getTicker(options = {}) {
    const query = this._buildQuery({
      symbol: options.symbol,
      symbols: options.symbols,
    });
    return this._fetch(`/ticker${query}`);
  }

  // ===========================================================================
  // HISTORICAL DATA
  // ===========================================================================

  /**
   * Get historical price data
   * @param {string} id Coin ID
   * @param {Object} [options]
   * @param {number} [options.days=30] Number of days (1, 7, 14, 30, 90, 180, 365)
   * @returns {Promise<Object>}
   */
  async getHistorical(id, options = {}) {
    const query = this._buildQuery({
      days: options.days,
    });
    return this._fetch(`/historical/${encodeURIComponent(id)}${query}`);
  }

  // ===========================================================================
  // DEFI & GAS
  // ===========================================================================

  /**
   * Get DeFi protocol data
   * @param {Object} [options]
   * @param {number} [options.limit=50] Number of protocols
   * @param {string} [options.category] Filter by category
   * @returns {Promise<Object>}
   */
  async getDefi(options = {}) {
    const query = this._buildQuery({
      limit: options.limit,
      category: options.category,
    });
    return this._fetch(`/defi${query}`);
  }

  /**
   * Get gas prices
   * @param {Object} [options]
   * @param {string} [options.network='all'] Network (all, ethereum, bitcoin)
   * @returns {Promise<Object>}
   */
  async getGas(options = {}) {
    const query = this._buildQuery({
      network: options.network,
    });
    return this._fetch(`/gas${query}`);
  }

  // ===========================================================================
  // ANALYTICS
  // ===========================================================================

  /**
   * Get trending coins
   * @returns {Promise<Object>}
   */
  async getTrending() {
    return this._fetch('/trending');
  }

  /**
   * Search for coins
   * @param {string} query Search query
   * @returns {Promise<Object>}
   */
  async search(query) {
    return this._fetch(`/search?q=${encodeURIComponent(query)}`);
  }

  /**
   * Get volatility metrics
   * @param {Object} [options]
   * @param {string} [options.ids] Comma-separated coin IDs
   * @returns {Promise<Object>}
   */
  async getVolatility(options = {}) {
    const query = this._buildQuery({
      ids: options.ids,
    });
    return this._fetch(`/volatility${query}`);
  }

  // ===========================================================================
  // BATCH & GRAPHQL
  // ===========================================================================

  /**
   * Execute multiple API calls in one request
   * @param {Array<{endpoint: string, params?: Object}>} requests
   * @returns {Promise<Object>}
   */
  async batch(requests) {
    return this._fetch('/batch', {
      method: 'POST',
      body: { requests },
    });
  }

  /**
   * Execute a GraphQL query
   * @param {string} query GraphQL query string
   * @param {Object} [variables] Query variables
   * @returns {Promise<Object>}
   */
  async graphql(query, variables = {}) {
    return this._fetch('/graphql', {
      method: 'POST',
      body: { query, variables },
    });
  }

  // ===========================================================================
  // WEBHOOKS
  // ===========================================================================

  /**
   * List webhook subscriptions
   * @returns {Promise<Object>}
   */
  async listWebhooks() {
    return this._fetch('/webhooks');
  }

  /**
   * Create a webhook subscription
   * @param {Object} webhook
   * @param {string} webhook.url Webhook URL
   * @param {string[]} webhook.events Events to subscribe to
   * @param {string} [webhook.secret] Optional secret for signatures
   * @returns {Promise<Object>}
   */
  async createWebhook(webhook) {
    return this._fetch('/webhooks', {
      method: 'POST',
      body: webhook,
    });
  }

  /**
   * Delete a webhook
   * @param {string} id Webhook ID
   * @returns {Promise<Object>}
   */
  async deleteWebhook(id) {
    return this._fetch(`/webhooks?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Check API health
   * @returns {Promise<Object>}
   */
  async health() {
    return this._fetch('/health');
  }

  /**
   * Get API documentation info
   * @returns {Promise<Object>}
   */
  async info() {
    return this._fetch('');
  }

  /**
   * Get OpenAPI specification
   * @returns {Promise<Object>}
   */
  async openapi() {
    return this._fetch('/openapi.json');
  }
}

// Default export for CommonJS compatibility
export default CryptoAPI;
