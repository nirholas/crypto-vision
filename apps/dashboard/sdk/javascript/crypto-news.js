/**
 * Free Crypto News JavaScript SDK
 *
 * Works in Node.js and browsers.
 * Free tier available - no API key required for basic endpoints.
 * API key enables higher rate limits and premium endpoints.
 *
 * Usage:
 *   import { CryptoNews } from './crypto-news.js';
 *
 *   // Free usage (100 requests/day on premium endpoints)
 *   const news = new CryptoNews();
 *
 *   // With API key (higher limits)
 *   const news = new CryptoNews({ apiKey: 'cda_free_xxx...' });
 *
 *   const articles = await news.getLatest(10);
 */

const DEFAULT_BASE_URL = 'https://free-crypto-news.vercel.app';

export class CryptoNews {
  /**
   * Create a new CryptoNews client
   * @param {Object} options Configuration options
   * @param {string} [options.baseUrl] Custom API URL
   * @param {string} [options.apiKey] API key for authenticated requests
   * @param {number} [options.timeout] Request timeout in ms (default: 30000)
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.apiKey = options.apiKey || null;
    this.timeout = options.timeout || 30000;
    this.lastRateLimit = null;
  }

  /**
   * Set API key for authenticated requests
   * @param {string} apiKey Your API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Get rate limit info from last request
   * @returns {{ remaining: number, limit: number, resetAt: number } | null}
   */
  getRateLimitInfo() {
    return this.lastRateLimit;
  }

  /**
   * @private
   */
  async _fetch(endpoint, options = {}) {
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'CryptoNewsSDK/1.0',
    };

    // Add API key if available
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    // Add x402 payment header if provided
    if (options.payment) {
      headers['X-PAYMENT'] = options.payment;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers,
        signal: controller.signal,
      });

      // Parse rate limit headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const limit = response.headers.get('X-RateLimit-Limit');
      const resetAt = response.headers.get('X-RateLimit-Reset');
      if (remaining && limit) {
        this.lastRateLimit = {
          remaining: parseInt(remaining),
          limit: parseInt(limit),
          resetAt: resetAt ? parseInt(resetAt) : Date.now() + 86400000,
        };
      }

      // Handle 402 Payment Required
      if (response.status === 402) {
        const error = new Error('Payment Required');
        error.paymentRequired = response.headers.get('X-PAYMENT-REQUIRED');
        throw error;
      }

      // Handle 429 Rate Limit
      if (response.status === 429) {
        const error = new Error('Rate limit exceeded');
        error.retryAfter = resetAt ? parseInt(resetAt) : undefined;
        throw error;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get latest crypto news
   * @param {number} limit - Max articles (1-50)
   * @param {string} source - Filter by source
   * @returns {Promise<Array>} Articles
   */
  async getLatest(limit = 10, source = null) {
    let endpoint = `/api/news?limit=${limit}`;
    if (source) endpoint += `&source=${source}`;
    const data = await this._fetch(endpoint);
    return data.articles;
  }

  /**
   * Search news by keywords
   * @param {string} keywords - Comma-separated terms
   * @param {number} limit - Max results (1-30)
   */
  async search(keywords, limit = 10) {
    const encoded = encodeURIComponent(keywords);
    const data = await this._fetch(`/api/search?q=${encoded}&limit=${limit}`);
    return data.articles;
  }

  /** Get DeFi-specific news */
  async getDefi(limit = 10) {
    const data = await this._fetch(`/api/defi?limit=${limit}`);
    return data.articles;
  }

  /** Get Bitcoin-specific news */
  async getBitcoin(limit = 10) {
    const data = await this._fetch(`/api/bitcoin?limit=${limit}`);
    return data.articles;
  }

  /** Get breaking news (last 2 hours) */
  async getBreaking(limit = 5) {
    const data = await this._fetch(`/api/breaking?limit=${limit}`);
    return data.articles;
  }

  /** Get list of all sources */
  async getSources() {
    const data = await this._fetch('/api/sources');
    return data.sources;
  }

  /** Get trending topics */
  async getTrending(limit = 10, hours = 24) {
    return this._fetch(`/api/trending?limit=${limit}&hours=${hours}`);
  }

  /** Get API statistics */
  async getStats() {
    return this._fetch('/api/stats');
  }

  /** Check API health */
  async getHealth() {
    return this._fetch('/api/health');
  }

  /** Get news with topic classification and sentiment */
  async analyze(limit = 20, topic = null, sentiment = null) {
    let endpoint = `/api/analyze?limit=${limit}`;
    if (topic) endpoint += `&topic=${encodeURIComponent(topic)}`;
    if (sentiment) endpoint += `&sentiment=${sentiment}`;
    return this._fetch(endpoint);
  }

  /** Get archived news */
  async getArchive(date = null, query = null, limit = 50) {
    let endpoint = '/api/archive?';
    const params = [];
    if (date) params.push(`date=${date}`);
    if (query) params.push(`q=${encodeURIComponent(query)}`);
    params.push(`limit=${limit}`);
    return this._fetch(endpoint + params.join('&'));
  }

  /** Find original sources of news */
  async getOrigins(query = null, category = null, limit = 20) {
    let endpoint = '/api/origins?';
    const params = [`limit=${limit}`];
    if (query) params.push(`q=${encodeURIComponent(query)}`);
    if (category) params.push(`category=${category}`);
    return this._fetch(endpoint + params.join('&'));
  }

  /** Get portfolio news with optional prices */
  async getPortfolio(coins, limit = 10, includePrices = true) {
    const coinsParam = Array.isArray(coins) ? coins.join(',') : coins;
    return this._fetch(
      `/api/portfolio?coins=${encodeURIComponent(coinsParam)}&limit=${limit}&prices=${includePrices}`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // PREMIUM / AUTHENTICATED ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get API key usage statistics (requires API key)
   * @returns {Promise<Object>} Usage data including tier, limits, and current usage
   */
  async getUsage() {
    if (!this.apiKey) {
      throw new Error('API key required. Call setApiKey() first.');
    }
    return this._fetch('/api/v1/usage');
  }

  /**
   * Get premium coin data (requires API key or x402 payment)
   * @param {string} coinId CoinGecko coin ID
   * @param {string} [payment] Optional x402 payment header
   */
  async getPremiumCoin(coinId, payment = null) {
    return this._fetch(`/api/v1/coins/${coinId}`, { payment });
  }

  /**
   * Get premium coins list (requires API key or x402 payment)
   * @param {Object} options Query options
   * @param {string} [payment] Optional x402 payment header
   */
  async getPremiumCoins(options = {}, payment = null) {
    const params = new URLSearchParams();
    if (options.page) params.set('page', options.page.toString());
    if (options.perPage) params.set('per_page', options.perPage.toString());
    if (options.order) params.set('order', options.order);
    if (options.ids) params.set('ids', options.ids);
    const query = params.toString() ? `?${params}` : '';
    return this._fetch(`/api/v1/coins${query}`, { payment });
  }

  /**
   * Get historical price data (requires API key or x402 payment)
   * @param {string} coinId CoinGecko coin ID
   * @param {number} [days=30] Number of days
   * @param {string} [payment] Optional x402 payment header
   */
  async getHistorical(coinId, days = 30, payment = null) {
    return this._fetch(`/api/v1/historical/${coinId}?days=${days}`, { payment });
  }

  /**
   * Export data (requires API key or x402 payment)
   * @param {Object} options Export options
   * @param {string} [payment] Optional x402 payment header
   */
  async exportData(options, payment = null) {
    const params = new URLSearchParams({ coin: options.coinId });
    if (options.format) params.set('format', options.format);
    if (options.days) params.set('days', options.days.toString());
    return this._fetch(`/api/v1/export?${params}`, { payment });
  }
}

// Convenience functions
export async function getCryptoNews(limit = 10) {
  return new CryptoNews().getLatest(limit);
}

export async function searchCryptoNews(keywords, limit = 10) {
  return new CryptoNews().search(keywords, limit);
}

// CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CryptoNews, getCryptoNews, searchCryptoNews };
}
