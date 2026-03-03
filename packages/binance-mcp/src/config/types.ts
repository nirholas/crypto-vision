// src/config/types.ts
// TypeScript interfaces for Binance.US API responses

/**
 * API Response wrapper
 */
export interface BinanceUsApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: BinanceUsApiError;
}

export interface BinanceUsApiError {
  code: number;
  msg: string;
}

/**
 * Rate Limit Information
 */
export interface RateLimitInfo {
  rateLimitType: "REQUEST_WEIGHT" | "ORDERS" | "RAW_REQUESTS";
  interval: "SECOND" | "MINUTE" | "HOUR" | "DAY";
  intervalNum: number;
  limit: number;
}

/**
 * Exchange Information
 */
export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  rateLimits: RateLimitInfo[];
  exchangeFilters: unknown[];
  symbols: SymbolInfo[];
}

export interface SymbolInfo {
  symbol: string;
  status: SymbolStatus;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  orderTypes: OrderType[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: SymbolFilter[];
  permissions: string[];
  defaultSelfTradePreventionMode: string;
  allowedSelfTradePreventionModes: string[];
}

export type SymbolStatus = "PRE_TRADING" | "TRADING" | "POST_TRADING" | "END_OF_DAY" | "HALT" | "AUCTION_MATCH" | "BREAK";

export type OrderType = "LIMIT" | "MARKET" | "STOP_LOSS_LIMIT" | "TAKE_PROFIT_LIMIT" | "LIMIT_MAKER";

export type OrderSide = "BUY" | "SELL";

export type TimeInForce = "GTC" | "IOC" | "FOK";

export type OrderStatus = 
  | "NEW" 
  | "PARTIALLY_FILLED" 
  | "FILLED" 
  | "CANCELED" 
  | "PENDING_CANCEL" 
  | "REJECTED" 
  | "EXPIRED" 
  | "EXPIRED_IN_MATCH";

export interface SymbolFilter {
  filterType: string;
  [key: string]: unknown;
}

/**
 * Order Book
 */
export interface OrderBook {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity][]
  asks: [string, string][]; // [price, quantity][]
}

/**
 * Trade
 */
export interface Trade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}

/**
 * Aggregate Trade
 */
export interface AggregateTrade {
  a: number;  // Aggregate tradeId
  p: string;  // Price
  q: string;  // Quantity
  f: number;  // First tradeId
  l: number;  // Last tradeId
  T: number;  // Timestamp
  m: boolean; // Was the buyer the maker?
  M: boolean; // Was the trade the best price match?
}

/**
 * Candlestick/Kline
 */
export type Kline = [
  number,   // Open time
  string,   // Open
  string,   // High
  string,   // Low
  string,   // Close
  string,   // Volume
  number,   // Close time
  string,   // Quote asset volume
  number,   // Number of trades
  string,   // Taker buy base asset volume
  string,   // Taker buy quote asset volume
  string    // Ignore
];

/**
 * 24hr Ticker
 */
export interface Ticker24hr {
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

/**
 * Price Ticker
 */
export interface PriceTicker {
  symbol: string;
  price: string;
}

/**
 * Book Ticker
 */
export interface BookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

/**
 * Account Information
 */
export interface AccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  commissionRates: {
    maker: string;
    taker: string;
    buyer: string;
    seller: string;
  };
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  brokered: boolean;
  requireSelfTradePrevention: boolean;
  updateTime: number;
  accountType: string;
  balances: Balance[];
  permissions: string[];
  tradeGroupId?: number;
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

/**
 * Order
 */
export interface Order {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  transactTime?: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: TimeInForce;
  type: OrderType;
  side: OrderSide;
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  workingTime?: number;
  origQuoteOrderQty: string;
  selfTradePreventionMode: string;
  preventedMatchId?: number;
  preventedQuantity?: string;
}

/**
 * OCO Order
 */
export interface OcoOrder {
  orderListId: number;
  contingencyType: string;
  listStatusType: string;
  listOrderStatus: string;
  listClientOrderId: string;
  transactionTime: number;
  symbol: string;
  orders: {
    symbol: string;
    orderId: number;
    clientOrderId: string;
  }[];
  orderReports?: Order[];
}

/**
 * User Trade
 */
export interface UserTrade {
  symbol: string;
  id: number;
  orderId: number;
  orderListId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
  isBestMatch: boolean;
}

/**
 * Deposit/Withdrawal
 */
export interface DepositHistory {
  amount: string;
  coin: string;
  network: string;
  status: number;
  address: string;
  addressTag: string;
  txId: string;
  insertTime: number;
  transferType: number;
  confirmTimes: string;
}

export interface WithdrawHistory {
  address: string;
  amount: string;
  applyTime: string;
  coin: string;
  id: string;
  withdrawOrderId?: string;
  network: string;
  transferType: number;
  status: number;
  transactionFee: string;
  txId: string;
  confirmNo?: number;
}

/**
 * Asset Configuration
 */
export interface AssetConfig {
  coin: string;
  depositAllEnable: boolean;
  withdrawAllEnable: boolean;
  name: string;
  free: string;
  locked: string;
  freeze: string;
  withdrawing: string;
  ipoing: string;
  ipoable: string;
  storage: string;
  isLegalMoney: boolean;
  trading: boolean;
  networkList: NetworkInfo[];
}

export interface NetworkInfo {
  network: string;
  coin: string;
  withdrawIntegerMultiple: string;
  isDefault: boolean;
  depositEnable: boolean;
  withdrawEnable: boolean;
  depositDesc: string;
  withdrawDesc: string;
  specialTips: string;
  specialWithdrawTips: string;
  name: string;
  resetAddressStatus: boolean;
  addressRegex: string;
  addressRule: string;
  memoRegex: string;
  withdrawFee: string;
  withdrawMin: string;
  withdrawMax: string;
  minConfirm: number;
  unLockConfirm: number;
  sameAddress: boolean;
  estimatedArrivalTime: number;
  busy: boolean;
  country: string;
}

/**
 * Staking
 */
export interface StakingAsset {
  stakingAsset: string;
  rewardAsset: string;
  apr: string;
  apy: string;
  unstakingPeriod: number;
  minStakingAmount: string;
  maxStakingAmount: string;
  autoRestake: boolean;
}

export interface StakingBalance {
  stakingAsset: string;
  holdingInStaking: string;
  pendingRedemption: string;
}

/**
 * OTC Trading
 */
export interface OtcCoinPair {
  fromCoin: string;
  toCoin: string;
  fromCoinMinAmount: string;
  fromCoinMaxAmount: string;
  toCoinMinAmount: string;
  toCoinMaxAmount: string;
}

export interface OtcQuote {
  symbol: string;
  ratio: string;
  inverseRatio: string;
  validTimestamp: number;
  toAmount: string;
  fromAmount: string;
}

/**
 * User Data Stream
 */
export interface ListenKeyResponse {
  listenKey: string;
}

/**
 * Custodial Solution Types (Unique to Binance.US)
 */
export interface CustodialAccountInfo {
  email: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Balance[];
}

export interface CustodialTransfer {
  txnId: string;
  clientTranId?: string;
  asset: string;
  amount: string;
  fromEmail: string;
  toEmail: string;
  status: string;
  timestamp: number;
}

/**
 * Credit Line Types (Unique to Binance.US)
 */
export interface CreditLineAccount {
  collaterals: CreditLineCollateral[];
  loans: CreditLineLoan[];
  creditLimit: string;
  availableCredit: string;
  usedCredit: string;
  status: string;
}

export interface CreditLineCollateral {
  asset: string;
  amount: string;
  collateralValue: string;
}

export interface CreditLineLoan {
  loanAsset: string;
  loanAmount: string;
  interestRate: string;
  accrueInterest: string;
}

export interface CreditLineAlert {
  alertId: string;
  alertType: string;
  alertTime: number;
  message: string;
}

/**
 * Sub-Account Types
 */
export interface SubAccount {
  email: string;
  isFreeze: boolean;
  createTime: number;
  isManagedSubAccount: boolean;
  isAssetManagementSubAccount: boolean;
}

export interface SubAccountTransfer {
  tranId: number;
  clientTranId?: string;
  fromEmail: string;
  toEmail: string;
  asset: string;
  amount: string;
  timestamp: number;
  status: string;
}

/**
 * Error Codes
 */
export const ERROR_CODES = {
  UNKNOWN: -1000,
  DISCONNECTED: -1001,
  UNAUTHORIZED: -1002,
  TOO_MANY_REQUESTS: -1003,
  UNEXPECTED_RESP: -1006,
  TIMEOUT: -1007,
  SERVER_BUSY: -1008,
  INVALID_TIMESTAMP: -1021,
  INVALID_SIGNATURE: -1022,
  ILLEGAL_CHARS: -1100,
  TOO_MANY_PARAMETERS: -1101,
  MANDATORY_PARAM_EMPTY_OR_MALFORMED: -1102,
  UNKNOWN_PARAM: -1103,
  BAD_SYMBOL: -1121,
  NEW_ORDER_REJECTED: -2010,
  CANCEL_REJECTED: -2011,
  NO_SUCH_ORDER: -2013,
  BAD_API_KEY_FMT: -2014,
  REJECTED_MBX_KEY: -2015,
  ORDER_ARCHIVED: -2026,
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
