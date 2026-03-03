// src/config/binanceUsClient.ts
import crypto from "crypto";

/**
 * Binance.US API Client Configuration
 * 
 * Base URLs:
 * - REST API: https://api.binance.us
 * - WebSocket: wss://stream.binance.us:9443
 * 
 * Authentication:
 * - API Key passed via X-MBX-APIKEY header
 * - Signature generated using HMAC SHA256
 * 
 * Key Differences from Binance.com:
 * - US regulatory compliance
 * - No futures, margin, or lending
 * - Custodial Solution API (unique to US)
 * - Credit Line API (unique to US)
 */

// API Configuration Constants
export const BINANCE_US_CONFIG = {
  BASE_URL: "https://api.binance.us",
  WS_URL: "wss://stream.binance.us:9443",
  DEFAULT_RECV_WINDOW: 5000,
  MAX_RECV_WINDOW: 60000,
} as const;

const API_KEY = process.env.BINANCE_US_API_KEY || "";
const API_SECRET = process.env.BINANCE_US_API_SECRET || "";
const BASE_URL = BINANCE_US_CONFIG.BASE_URL;

// ============================================================================
// Type Definitions
// ============================================================================

/** Rate limit information from API response headers */
export interface RateLimitInfo {
    usedWeight: number;
    weightLimit: number;
    orderCount?: number;
    retryAfter?: number;
}

/** API response wrapper with rate limit info */
export interface BinanceUsResponse<T> {
    data: T;
    rateLimitInfo?: RateLimitInfo;
}

/** Ping response (empty object) */
export interface PingResponse {}

/** Server time response */
export interface ServerTimeResponse {
    serverTime: number;
}

/** System status response */
export interface SystemStatusResponse {
    status: 0 | 1; // 0: normal, 1: system maintenance
}

/** Symbol information in exchange info */
export interface SymbolInfo {
    symbol: string;
    status: "PRE_TRADING" | "TRADING" | "POST_TRADING" | "END_OF_DAY" | "HALT" | "AUCTION_MATCH" | "BREAK";
    baseAsset: string;
    baseAssetPrecision: number;
    quoteAsset: string;
    quotePrecision: number;
    quoteAssetPrecision: number;
    baseCommissionPrecision: number;
    quoteCommissionPrecision: number;
    orderTypes: string[];
    icebergAllowed: boolean;
    ocoAllowed: boolean;
    quoteOrderQtyMarketAllowed: boolean;
    allowTrailingStop: boolean;
    cancelReplaceAllowed: boolean;
    isSpotTradingAllowed: boolean;
    isMarginTradingAllowed: boolean;
    filters: any[];
    permissions: string[];
}

/** Exchange information response */
export interface ExchangeInfoResponse {
    timezone: string;
    serverTime: number;
    rateLimits: any[];
    exchangeFilters: any[];
    symbols: SymbolInfo[];
    permissions: string[];
    defaultSelfTradePreventionMode?: string;
    allowedSelfTradePreventionModes?: string[];
}

/** Order book response */
export interface OrderBookResponse {
    lastUpdateId: number;
    bids: [string, string][]; // [price, quantity][]
    asks: [string, string][]; // [price, quantity][]
}

/** Trade response */
export interface TradeResponse {
    id: number;
    price: string;
    qty: string;
    quoteQty: string;
    time: number;
    isBuyerMaker: boolean;
    isBestMatch: boolean;
}

/** Aggregate trade response */
export interface AggTradeResponse {
    a: number;    // Aggregate tradeId
    p: string;    // Price
    q: string;    // Quantity
    f: number;    // First tradeId
    l: number;    // Last tradeId
    T: number;    // Timestamp
    m: boolean;   // Was the buyer the maker?
    M: boolean;   // Was the trade the best price match?
}

/** Formatted aggregate trade (human-readable) */
export interface FormattedAggTrade {
    aggregateTradeId: number;
    price: string;
    quantity: string;
    firstTradeId: number;
    lastTradeId: number;
    timestamp: number;
    timestampISO: string;
    isBuyerMaker: boolean;
    isBestMatch: boolean;
}

/** Raw kline data (array format from API) */
export type KlineRaw = [
    number,  // 0: Open time
    string,  // 1: Open price
    string,  // 2: High price
    string,  // 3: Low price
    string,  // 4: Close price
    string,  // 5: Volume
    number,  // 6: Close time
    string,  // 7: Quote asset volume
    number,  // 8: Number of trades
    string,  // 9: Taker buy base asset volume
    string,  // 10: Taker buy quote asset volume
    string   // 11: Ignore
];

/** Formatted kline (human-readable) */
export interface FormattedKline {
    openTime: number;
    openTimeISO: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    closeTimeISO: string;
    quoteAssetVolume: string;
    numberOfTrades: number;
    takerBuyBaseVolume: string;
    takerBuyQuoteVolume: string;
}

/** Average price response */
export interface AvgPriceResponse {
    mins: number;
    price: string;
}

/** Ticker price response */
export interface TickerPriceResponse {
    symbol: string;
    price: string;
}

/** Book ticker response */
export interface BookTickerResponse {
    symbol: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
}

/** 24hr ticker response */
export interface Ticker24hrResponse {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    prevClosePrice: string;
    lastPrice: string;
    lastQty: string;
    bidPrice: string;
    bidQty: string;
    askPrice: string;
    askQty: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

/** Rolling window ticker response */
export interface RollingWindowTickerResponse {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    weightedAvgPrice: string;
    openPrice: string;
    highPrice: string;
    lowPrice: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
    openTime: number;
    closeTime: number;
    firstId: number;
    lastId: number;
    count: number;
}

// ============================================================================
// Error Classes
// ============================================================================

/** Custom error class for Binance.US API errors */
export class BinanceUsApiError extends Error {
    constructor(
        public readonly code: number,
        message: string,
        public readonly httpStatus: number,
        public readonly rateLimitInfo?: RateLimitInfo
    ) {
        super(message);
        this.name = "BinanceUsApiError";
    }
}

/** Rate limit error (HTTP 429) */
export class RateLimitError extends BinanceUsApiError {
    constructor(
        message: string,
        public readonly retryAfter: number,
        rateLimitInfo?: RateLimitInfo
    ) {
        super(-1003, message, 429, rateLimitInfo);
        this.name = "RateLimitError";
    }
}

/** IP ban error (HTTP 418) */
export class IpBanError extends BinanceUsApiError {
    constructor(
        message: string,
        public readonly retryAfter: number,
        rateLimitInfo?: RateLimitInfo
    ) {
        super(-1003, message, 418, rateLimitInfo);
        this.name = "IpBanError";
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate HMAC SHA256 signature for Binance.US API requests
 */
export function generateSignature(queryString: string): string {
    return crypto
        .createHmac("sha256", API_SECRET)
        .update(queryString)
        .digest("hex");
}

/**
 * Build query string from parameters object
 */
export function buildQueryString(params: Record<string, any>): string {
    const filteredParams = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join("&");
    return filteredParams;
}

/**
 * Check if API credentials are configured
 */
export function hasApiCredentials(): boolean {
    return !!(API_KEY && API_SECRET);
}

/**
 * Check if API key is configured (for MARKET_DATA requests)
 */
export function hasApiKey(): boolean {
    return !!API_KEY;
}

/**
 * Get current timestamp in milliseconds
 */
export function getTimestamp(): number {
    return Date.now();
}

/**
 * Parse rate limit info from response headers
 */
function parseRateLimitInfo(headers: Headers): RateLimitInfo | undefined {
    const usedWeight = headers.get("X-MBX-USED-WEIGHT-1M");
    const retryAfter = headers.get("Retry-After");
    
    if (!usedWeight && !retryAfter) return undefined;
    
    return {
        usedWeight: usedWeight ? parseInt(usedWeight, 10) : 0,
        weightLimit: 1200, // Default weight limit per minute
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
    };
}

/**
 * Format a kline array into a readable object
 */
export function formatKline(kline: KlineRaw): FormattedKline {
    return {
        openTime: kline[0],
        openTimeISO: new Date(kline[0]).toISOString(),
        open: kline[1],
        high: kline[2],
        low: kline[3],
        close: kline[4],
        volume: kline[5],
        closeTime: kline[6],
        closeTimeISO: new Date(kline[6]).toISOString(),
        quoteAssetVolume: kline[7],
        numberOfTrades: kline[8],
        takerBuyBaseVolume: kline[9],
        takerBuyQuoteVolume: kline[10],
    };
}

/**
 * Format an aggregate trade into a readable object
 */
export function formatAggTrade(trade: AggTradeResponse): FormattedAggTrade {
    return {
        aggregateTradeId: trade.a,
        price: trade.p,
        quantity: trade.q,
        firstTradeId: trade.f,
        lastTradeId: trade.l,
        timestamp: trade.T,
        timestampISO: new Date(trade.T).toISOString(),
        isBuyerMaker: trade.m,
        isBestMatch: trade.M,
    };
}

// ============================================================================
// API Request Functions
// ============================================================================

/**
 * Make a signed request to Binance.US API
 * @param method HTTP method
 * @param endpoint API endpoint path
 * @param params Request parameters
 * @param recvWindow Optional receive window (default 5000, max 60000)
 */
export async function makeSignedRequest(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    params: Record<string, any> = {},
    recvWindow: number = BINANCE_US_CONFIG.DEFAULT_RECV_WINDOW
): Promise<any> {
    // Validate credentials
    if (!hasApiCredentials()) {
        throw new BinanceUsApiError(
            -2015,
            "API credentials required. Set BINANCE_US_API_KEY and BINANCE_US_API_SECRET environment variables.",
            401
        );
    }
    
    // Validate recvWindow
    if (recvWindow > BINANCE_US_CONFIG.MAX_RECV_WINDOW) {
        recvWindow = BINANCE_US_CONFIG.MAX_RECV_WINDOW;
    }
    
    // Add timestamp and recvWindow to params
    const timestamp = Date.now();
    const paramsWithTimestamp = { ...params, timestamp, recvWindow };
    
    // Build query string and generate signature
    const queryString = buildQueryString(paramsWithTimestamp);
    const signature = generateSignature(queryString);
    const signedQueryString = `${queryString}&signature=${signature}`;
    
    // Build URL and headers
    const url = method === "GET" || method === "DELETE"
        ? `${BASE_URL}${endpoint}?${signedQueryString}`
        : `${BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
        "X-MBX-APIKEY": API_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
    };
    
    const fetchOptions: RequestInit = {
        method,
        headers
    };
    
    // For POST and PUT requests, send data in body
    if (method === "POST" || method === "PUT") {
        fetchOptions.body = signedQueryString;
    }
    
    const response = await fetch(url, fetchOptions);
    const rateLimitInfo = parseRateLimitInfo(response.headers);
    
    // Handle rate limiting (429)
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
        throw new RateLimitError(
            `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
            retryAfter,
            rateLimitInfo
        );
    }
    
    // Handle IP ban (418)
    if (response.status === 418) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "120", 10);
        throw new IpBanError(
            `IP temporarily banned. Ban lifted after ${retryAfter} seconds.`,
            retryAfter,
            rateLimitInfo
        );
    }
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: response.statusText }));
        throw new BinanceUsApiError(
            errorData.code || response.status,
            errorData.msg || response.statusText,
            response.status,
            rateLimitInfo
        );
    }
    
    return response.json();
}

/**
 * Make a public (unsigned) request to Binance.US API
 */
export async function makePublicRequest(
    method: "GET",
    endpoint: string,
    params: Record<string, any> = {}
): Promise<any> {
    const queryString = buildQueryString(params);
    const url = queryString 
        ? `${BASE_URL}${endpoint}?${queryString}`
        : `${BASE_URL}${endpoint}`;
    
    const response = await fetch(url, { method });
    const rateLimitInfo = parseRateLimitInfo(response.headers);
    
    // Handle rate limiting (429)
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
        throw new RateLimitError(
            `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
            retryAfter,
            rateLimitInfo
        );
    }
    
    // Handle IP ban (418)
    if (response.status === 418) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "120", 10);
        throw new IpBanError(
            `IP temporarily banned. Ban lifted after ${retryAfter} seconds.`,
            retryAfter,
            rateLimitInfo
        );
    }
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: response.statusText }));
        throw new BinanceUsApiError(
            errorData.code || response.status,
            errorData.msg || response.statusText,
            response.status,
            rateLimitInfo
        );
    }
    
    return response.json();
}

export const binanceUsConfig = {
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    baseUrl: BASE_URL,
    wsUrl: BINANCE_US_CONFIG.WS_URL
};

/**
 * Make a MARKET_DATA request (requires API key but no signature)
 */
export async function makeMarketDataRequest(
    method: "GET",
    endpoint: string,
    params: Record<string, any> = {}
): Promise<any> {
    // Validate API key
    if (!hasApiKey()) {
        throw new BinanceUsApiError(
            -2015,
            "API key required for MARKET_DATA endpoints. Set BINANCE_US_API_KEY environment variable.",
            401
        );
    }
    
    const queryString = buildQueryString(params);
    const url = queryString 
        ? `${BASE_URL}${endpoint}?${queryString}`
        : `${BASE_URL}${endpoint}`;
    
    const headers: HeadersInit = {
        "X-MBX-APIKEY": API_KEY
    };
    
    const response = await fetch(url, { method, headers });
    const rateLimitInfo = parseRateLimitInfo(response.headers);
    
    // Handle rate limiting (429)
    if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
        throw new RateLimitError(
            `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
            retryAfter,
            rateLimitInfo
        );
    }
    
    // Handle IP ban (418)
    if (response.status === 418) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "120", 10);
        throw new IpBanError(
            `IP temporarily banned. Ban lifted after ${retryAfter} seconds.`,
            retryAfter,
            rateLimitInfo
        );
    }
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: response.statusText }));
        throw new BinanceUsApiError(
            errorData.code || response.status,
            errorData.msg || response.statusText,
            response.status,
            rateLimitInfo
        );
    }
    
    return response.json();
}

/**
 * Unified request helper for all Binance.US API endpoints
 * @param method HTTP method
 * @param path API endpoint path
 * @param params Request parameters
 * @param signed Whether request requires HMAC signature
 * @param apiKeyRequired Whether request requires API key (for MARKET_DATA endpoints)
 * @param recvWindow Optional receive window for signed requests (default 5000, max 60000)
 */
export async function binanceUsRequest<T = any>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params: Record<string, any> = {},
    signed: boolean = false,
    apiKeyRequired: boolean = false,
    recvWindow?: number
): Promise<T> {
    if (signed) {
        return makeSignedRequest(method, path, params, recvWindow) as Promise<T>;
    } else if (apiKeyRequired) {
        return makeMarketDataRequest("GET", path, params) as Promise<T>;
    } else {
        return makePublicRequest("GET", path, params) as Promise<T>;
    }
}

// ============================================================================
// Valid Parameter Values
// ============================================================================

/** Valid limit values for order book depth endpoint */
export const ORDER_BOOK_VALID_LIMITS = [5, 10, 20, 50, 100, 500, 1000, 5000] as const;

/** Valid kline intervals */
export const KLINE_INTERVALS = [
    "1m", "3m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h",
    "1d", "3d", "1w", "1M"
] as const;

/** Valid rolling window sizes */
export const ROLLING_WINDOW_SIZES = [
    "1m", "2m", "3m", "4m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h",
    "1d", "3d", "7d"
] as const;

/** Max results for trade endpoints */
export const MAX_TRADES_LIMIT = 1000;
export const DEFAULT_TRADES_LIMIT = 500;

/** Max results for klines endpoint */
export const MAX_KLINES_LIMIT = 1000;
export const DEFAULT_KLINES_LIMIT = 500;
