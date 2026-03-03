// src/config/binanceClient.ts
// Existing SDK packages
import { Spot } from "@binance/spot";
import { Spot as ConnectorSpot } from "@binance/connector-typescript";
import { SimpleEarn } from "@binance/simple-earn";
import { Algo } from "@binance/algo";
import { C2C } from "@binance/c2c";
import { Convert } from "@binance/convert";
import { Wallet } from "@binance/wallet";
import { CopyTrading } from "@binance/copy-trading";
import { Fiat } from "@binance/fiat";
import { NFT } from "@binance/nft";
import { Pay } from "@binance/pay";
import { Rebate } from "@binance/rebate";
import { DualInvestment } from "@binance/dual-investment";
import { Mining } from "@binance/mining";
import { VIPLoan } from "@binance/vip-loan";
import { Staking } from "@binance/staking";
import { AutoInvest } from "@binance/auto-invest";
import { CryptoLoan } from "@binance/crypto-loan";
import { SubAccount } from "@binance/sub-account";
import crypto from "crypto";

const API_KEY = process.env.BINANCE_API_KEY ?? "";
const API_SECRET = process.env.BINANCE_API_SECRET ?? "";
const BASE_URL = "https://api.binance.com";

const configurationRestAPI = {
    apiKey: API_KEY,
    apiSecret: API_SECRET,
    basePath: BASE_URL
};

// Spot Trading
export const spotClient = new Spot({ configurationRestAPI });

// Connector-typescript client (for margin and other APIs)
export const connectorClient = new ConnectorSpot(API_KEY, API_SECRET, { baseURL: BASE_URL });

// Algo Trading
export const algoClient = new Algo({ configurationRestAPI });

// Earn & Investment
export const simpleEarnClient = new SimpleEarn({ configurationRestAPI });
export const dualInvestmentClient = new DualInvestment({ configurationRestAPI });
export const stakingClient = new Staking({ configurationRestAPI });
export const autoInvestClient = new AutoInvest({ configurationRestAPI });

// Trading
export const c2cClient = new C2C({ configurationRestAPI });
export const convertClient = new Convert({ configurationRestAPI });
export const copyTradingClient = new CopyTrading({ configurationRestAPI });

// Loans
export const vipLoanClient = new VIPLoan({ configurationRestAPI });
export const cryptoLoanClient = new CryptoLoan({ configurationRestAPI });

// Wallet & Finance
export const walletClient = new Wallet({ configurationRestAPI });
export const fiatClient = new Fiat({ configurationRestAPI });

// Sub-Account Management
export const subAccountClient = new SubAccount({ configurationRestAPI });

// Other
export const nftClient = new NFT({ configurationRestAPI });
export const payClient = new Pay({ configurationRestAPI });
export const rebateClient = new Rebate({ configurationRestAPI });
export const miningClient = new Mining({ configurationRestAPI });

// Generic REST client for APIs without dedicated packages
// (Margin, Futures, Options, Gift Card, Portfolio Margin)
function generateSignature(queryString: string): string {
    return crypto.createHmac("sha256", API_SECRET).update(queryString).digest("hex");
}

async function makeSignedRequest(
    method: "GET" | "POST" | "DELETE",
    endpoint: string,
    params: Record<string, any> = {}
): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    const queryString = new URLSearchParams(
        Object.fromEntries(Object.entries(queryParams).map(([k, v]) => [k, String(v)]))
    ).toString();
    const signature = generateSignature(queryString);
    const url = `${BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
        method,
        headers: {
            "X-MBX-APIKEY": API_KEY,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Binance API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

async function makePublicRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const queryString = new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    const url = `${BASE_URL}${endpoint}${queryString ? "?" + queryString : ""}`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Binance API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

// Portfolio Margin client wrapper
export const portfolioMarginClient = {
    getAccount: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/portfolio/account", params),
    getCollateralRate: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/portfolio/collateralRate", params),
    getBankruptcyLoanAmount: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/portfolio/pmLoan", params),
    repayBankruptcyLoan: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/portfolio/repay", params),
    getInterestHistory: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/portfolio/interest-history", params),
    getAssetIndexPrice: (params: Record<string, any> = {}) => 
        makePublicRequest("/sapi/v1/portfolio/asset-index-price", params),
    fundAutoCollection: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/portfolio/auto-collection", params),
    fundCollection: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/portfolio/asset-collection", params),
    bnbTransfer: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/portfolio/bnb-transfer", params),
    changeAutoRepayFutures: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/portfolio/repay-futures-switch", params),
    getAutoRepayFuturesStatus: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/portfolio/repay-futures-switch", params),
    repayFuturesNegativeBalance: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/portfolio/repay-futures-negative-balance", params),
    getAssetLeverage: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/portfolio/margin-asset-leverage", params),
    getBalance: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/portfolio/balance", params)
};

// Gift Card client wrapper
export const giftCardClient = {
    createCode: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/giftcard/createCode", params),
    createDualTokenCode: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/giftcard/buyCode", params),
    redeemCode: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/giftcard/redeemCode", params),
    verify: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/giftcard/verify", params),
    rsaPublicKey: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/giftcard/cryptography/rsa-public-key", params),
    buyCode: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/giftcard/buyCode", params),
    getTokenLimit: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/giftcard/buyCode/token-limit", params)
};

// Margin client wrapper
export const marginClient = {
    borrow: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/margin/loan", params),
    repay: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/margin/repay", params),
    getAccount: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/margin/account", params),
    getMaxBorrowable: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/margin/maxBorrowable", params),
    getMaxTransferable: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/margin/maxTransferable", params),
    transfer: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/margin/transfer", params),
    getAllPairs: (params: Record<string, any> = {}) => 
        makePublicRequest("/sapi/v1/margin/allPairs", params),
    getPriceIndex: (params: Record<string, any> = {}) => 
        makePublicRequest("/sapi/v1/margin/priceIndex", params),
    newOrder: (params: Record<string, any> = {}) => 
        makeSignedRequest("POST", "/sapi/v1/margin/order", params),
    cancelOrder: (params: Record<string, any> = {}) => 
        makeSignedRequest("DELETE", "/sapi/v1/margin/order", params),
    getOpenOrders: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/margin/openOrders", params),
    getAllOrders: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/margin/allOrders", params),
    getMyTrades: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/margin/myTrades", params),
    cancelAllOpenOrders: (params: Record<string, any> = {}) =>
        makeSignedRequest("DELETE", "/sapi/v1/margin/openOrders", params),
    getLoanRecord: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/loan", params),
    getRepayRecord: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/repay", params),
    getInterestHistory: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/interestHistory", params),
    getForceLiquidationRecord: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/forceLiquidationRec", params),
    getIsolatedAccount: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/isolated/account", params),
    enableIsolatedAccount: (params: Record<string, any> = {}) =>
        makeSignedRequest("POST", "/sapi/v1/margin/isolated/account", params),
    disableIsolatedAccount: (params: Record<string, any> = {}) =>
        makeSignedRequest("DELETE", "/sapi/v1/margin/isolated/account", params),
    getIsolatedMarginPairs: (params: Record<string, any> = {}) =>
        makePublicRequest("/sapi/v1/margin/isolated/allPairs", params),
    getIsolatedMarginTier: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/isolatedMarginTier", params),
    getCrossMarginFee: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/crossMarginData", params),
    getIsolatedMarginFee: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/isolatedMarginData", params),
    getSmallLiabilityExchangeCoinList: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/exchange-small-liability", params),
    smallLiabilityExchange: (params: Record<string, any> = {}) =>
        makeSignedRequest("POST", "/sapi/v1/margin/exchange-small-liability", params),
    getSmallLiabilityExchangeHistory: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/exchange-small-liability-history", params),
    getDustLog: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/dribblet", params),
    getCapitalFlow: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/capital-flow", params),
    getDelistSchedule: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/delist-schedule", params),
    getAvailableInventory: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/available-inventory", params),
    getAllAssets: (params: Record<string, any> = {}) =>
        makePublicRequest("/sapi/v1/margin/allAssets", params),
    getInterestRateHistory: (params: Record<string, any> = {}) =>
        makeSignedRequest("GET", "/sapi/v1/margin/interestRateHistory", params)
};

// Helper for Futures API with different base URLs
const FUTURES_USD_BASE_URL = "https://fapi.binance.com";
const FUTURES_COIN_BASE_URL = "https://dapi.binance.com";

async function makeFuturesSignedRequest(
    baseUrl: string,
    method: "GET" | "POST" | "DELETE" | "PUT",
    endpoint: string,
    params: Record<string, any> = {}
): Promise<any> {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp };
    const queryString = new URLSearchParams(
        Object.fromEntries(Object.entries(queryParams).map(([k, v]) => [k, String(v)]))
    ).toString();
    const signature = generateSignature(queryString);
    const url = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
        method,
        headers: {
            "X-MBX-APIKEY": API_KEY,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Binance API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

async function makeFuturesPublicRequest(
    baseUrl: string,
    endpoint: string,
    params: Record<string, any> = {}
): Promise<any> {
    const queryString = new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    const url = `${baseUrl}${endpoint}${queryString ? "?" + queryString : ""}`;

    const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Binance API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    return response.json();
}

// Futures USD-M client wrapper
export const futuresClient = {
    // Market Data
    ping: () => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/ping"),
    time: () => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/time"),
    exchangeInfo: () => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/exchangeInfo"),
    depth: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/depth", params),
    trades: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/trades", params),
    historicalTrades: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/historicalTrades", params),
    aggTrades: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/aggTrades", params),
    klines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/klines", params),
    continuousKlines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/continuousKlines", params),
    indexPriceKlines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/indexPriceKlines", params),
    markPriceKlines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/markPriceKlines", params),
    premiumIndex: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/premiumIndex", params),
    fundingRate: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/fundingRate", params),
    ticker24hr: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/ticker/24hr", params),
    tickerPrice: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/ticker/price", params),
    bookTicker: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/ticker/bookTicker", params),
    openInterest: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_USD_BASE_URL, "/fapi/v1/openInterest", params),
    // Account/Trade
    newOrder: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "POST", "/fapi/v1/order", params),
    batchOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "POST", "/fapi/v1/batchOrders", params),
    getOrder: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/order", params),
    cancelOrder: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "DELETE", "/fapi/v1/order", params),
    cancelAllOpenOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "DELETE", "/fapi/v1/allOpenOrders", params),
    cancelBatchOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "DELETE", "/fapi/v1/batchOrders", params),
    openOrders: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/openOrders", params),
    allOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/allOrders", params),
    balance: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v2/balance", params),
    account: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v2/account", params),
    leverage: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "POST", "/fapi/v1/leverage", params),
    marginType: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "POST", "/fapi/v1/marginType", params),
    positionMargin: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "POST", "/fapi/v1/positionMargin", params),
    positionRisk: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v2/positionRisk", params),
    userTrades: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/userTrades", params),
    income: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/income", params),
    commissionRate: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/commissionRate", params),
    adlQuantile: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/adlQuantile", params),
    forceOrders: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/forceOrders", params),
    positionMode: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "GET", "/fapi/v1/positionSide/dual", params),
    changePositionMode: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "POST", "/fapi/v1/positionSide/dual", params),
    // User Data Stream
    createListenKey: () => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "POST", "/fapi/v1/listenKey", {}),
    keepAliveListenKey: () => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "PUT", "/fapi/v1/listenKey", {}),
    closeListenKey: () => makeFuturesSignedRequest(FUTURES_USD_BASE_URL, "DELETE", "/fapi/v1/listenKey", {})
};

// Futures COIN-M client wrapper (delivery)
export const deliveryClient = {
    // Market Data
    ping: () => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/ping"),
    time: () => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/time"),
    exchangeInfo: () => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/exchangeInfo"),
    depth: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/depth", params),
    trades: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/trades", params),
    historicalTrades: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/historicalTrades", params),
    aggTrades: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/aggTrades", params),
    klines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/klines", params),
    continuousKlines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/continuousKlines", params),
    indexPriceKlines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/indexPriceKlines", params),
    markPriceKlines: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/markPriceKlines", params),
    premiumIndex: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/premiumIndex", params),
    fundingRate: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/fundingRate", params),
    ticker24hr: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/ticker/24hr", params),
    tickerPrice: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/ticker/price", params),
    bookTicker: (params: Record<string, any> = {}) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/ticker/bookTicker", params),
    openInterest: (params: Record<string, any>) => makeFuturesPublicRequest(FUTURES_COIN_BASE_URL, "/dapi/v1/openInterest", params),
    // Account/Trade
    newOrder: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "POST", "/dapi/v1/order", params),
    batchOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "POST", "/dapi/v1/batchOrders", params),
    getOrder: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/order", params),
    cancelOrder: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "DELETE", "/dapi/v1/order", params),
    cancelAllOpenOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "DELETE", "/dapi/v1/allOpenOrders", params),
    cancelBatchOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "DELETE", "/dapi/v1/batchOrders", params),
    openOrders: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/openOrders", params),
    allOrders: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/allOrders", params),
    balance: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/balance", params),
    account: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/account", params),
    leverage: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "POST", "/dapi/v1/leverage", params),
    marginType: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "POST", "/dapi/v1/marginType", params),
    positionMargin: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "POST", "/dapi/v1/positionMargin", params),
    positionRisk: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/positionRisk", params),
    userTrades: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/userTrades", params),
    income: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/income", params),
    commissionRate: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/commissionRate", params),
    adlQuantile: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/adlQuantile", params),
    forceOrders: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/forceOrders", params),
    positionMode: (params: Record<string, any> = {}) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "GET", "/dapi/v1/positionSide/dual", params),
    changePositionMode: (params: Record<string, any>) => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "POST", "/dapi/v1/positionSide/dual", params),
    // User Data Stream
    createListenKey: () => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "POST", "/dapi/v1/listenKey", {}),
    keepAliveListenKey: () => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "PUT", "/dapi/v1/listenKey", {}),
    closeListenKey: () => makeFuturesSignedRequest(FUTURES_COIN_BASE_URL, "DELETE", "/dapi/v1/listenKey", {})
};

// Sub-Account client wrapper (using REST API)
export const subAccountApiClient = {
    createVirtualSubAccount: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/virtualSubAccount", params),
    getSubAccountList: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/sub-account/list", params),
    getSubAccountSpotSummary: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/sub-account/spotSummary", params),
    getSubAccountStatus: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/sub-account/status", params),
    getSubAccountAssets: (params: Record<string, any>) => 
        makeSignedRequest("GET", "/sapi/v3/sub-account/assets", params),
    enableMarginForSubAccount: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/margin/enable", params),
    enableFuturesForSubAccount: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/futures/enable", params),
    getSubAccountMarginSummary: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/sub-account/margin/accountSummary", params),
    getSubAccountFuturesSummary: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v2/sub-account/futures/accountSummary", params),
    getSubAccountFuturesPositionRisk: (params: Record<string, any>) => 
        makeSignedRequest("GET", "/sapi/v2/sub-account/futures/positionRisk", params),
    transferToSubAccount: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/transfer/subToSub", params),
    transferToMaster: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/transfer/subToMaster", params),
    subAccountUniversalTransfer: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/universalTransfer", params),
    getSubAccountUniversalTransferHistory: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/sub-account/universalTransfer", params),
    getSubAccountTransferHistory: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/sub-account/sub/transfer/history", params),
    getSubAccountDepositAddress: (params: Record<string, any>) => 
        makeSignedRequest("GET", "/sapi/v1/capital/deposit/subAddress", params),
    getSubAccountDepositHistory: (params: Record<string, any> = {}) => 
        makeSignedRequest("GET", "/sapi/v1/capital/deposit/subHisrec", params),
    createSubAccountApiKey: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/subAccountApi/ipRestriction", params),
    deleteSubAccountApiKey: (params: Record<string, any>) => 
        makeSignedRequest("DELETE", "/sapi/v1/sub-account/subAccountApi/ipRestriction/ipList", params),
    getSubAccountApiKeyIpRestriction: (params: Record<string, any>) => 
        makeSignedRequest("GET", "/sapi/v1/sub-account/subAccountApi/ipRestriction", params),
    updateSubAccountApiKeyIpRestriction: (params: Record<string, any>) => 
        makeSignedRequest("POST", "/sapi/v1/sub-account/subAccountApi/ipRestriction", params)
};

// Options client wrapper
const OPTIONS_BASE_URL = "https://eapi.binance.com";

export const optionsClient = {
    // Market Data
    ping: () => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/ping"),
    time: () => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/time"),
    exchangeInfo: () => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/exchangeInfo"),
    depth: (params: Record<string, any>) => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/depth", params),
    trades: (params: Record<string, any>) => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/trades", params),
    klines: (params: Record<string, any>) => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/klines", params),
    mark: (params: Record<string, any> = {}) => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/mark", params),
    ticker: (params: Record<string, any> = {}) => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/ticker", params),
    index: (params: Record<string, any>) => makeFuturesPublicRequest(OPTIONS_BASE_URL, "/eapi/v1/index", params),
    // Account/Trade
    newOrder: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "POST", "/eapi/v1/order", params),
    batchOrders: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "POST", "/eapi/v1/batchOrders", params),
    cancelOrder: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "DELETE", "/eapi/v1/order", params),
    cancelBatchOrders: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "DELETE", "/eapi/v1/batchOrders", params),
    cancelAllOrders: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "DELETE", "/eapi/v1/allOpenOrders", params),
    getOrder: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/order", params),
    openOrders: (params: Record<string, any> = {}) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/openOrders", params),
    historyOrders: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/historyOrders", params),
    position: (params: Record<string, any> = {}) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/position", params),
    userTrades: (params: Record<string, any>) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/userTrades", params),
    account: (params: Record<string, any> = {}) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/account", params),
    exerciseRecord: (params: Record<string, any> = {}) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/exerciseRecord", params),
    bill: (params: Record<string, any> = {}) => makeFuturesSignedRequest(OPTIONS_BASE_URL, "GET", "/eapi/v1/bill", params),
    // User Data Stream
    createListenKey: () => makeFuturesSignedRequest(OPTIONS_BASE_URL, "POST", "/eapi/v1/listenKey", {}),
    keepAliveListenKey: () => makeFuturesSignedRequest(OPTIONS_BASE_URL, "PUT", "/eapi/v1/listenKey", {}),
    closeListenKey: () => makeFuturesSignedRequest(OPTIONS_BASE_URL, "DELETE", "/eapi/v1/listenKey", {})
};
