/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Core TypeScript type definitions for MCP Bitnovo Pay Integration

export type PaymentType = 'onchain' | 'redirect';

export type PaymentStatusCode =
  | 'NR' // Not Ready
  | 'PE' // Pending
  | 'AC' // Awaiting Completion
  | 'IA' // Insufficient Amount
  | 'OC' // Out of Condition
  | 'CO' // Completed
  | 'CA' // Cancelled
  | 'EX' // Expired
  | 'FA'; // Failed

export interface Payment {
  identifier: string;
  amount: number;
  currency?: string;
  fiat?: string;
  notes?: string;
  paymentType: PaymentType;
  address?: string;
  paymentUri?: string;
  webUrl?: string;
  expectedInputAmount?: number;
  rate?: number;
  merchantUrlOk?: string;
  merchantUrlKo?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface Currency {
  symbol: string; // Internal symbol for API calls (e.g., BTC_TEST, USDC_ETH_TEST5)
  name: string;
  minAmount: number;
  maxAmount: number | null;
  network_image: string;
  blockchain: string; // Internal blockchain identifier
  original_symbol: string; // User-facing symbol (e.g., BTC, USDC)
  original_blockchain: string; // User-facing blockchain name (e.g., Bitcoin Network, Ethereum Network)
  requiresMemo: boolean;
  decimals: number;
  isActive: boolean;
  currentRate?: number;
}

export interface PaymentStatus {
  identifier: string;
  status: PaymentStatusCode;
  statusDescription?: string;
  confirmedAmount?: number;
  unconfirmedAmount?: number;
  cryptoAmount?: number;
  expiredTime?: string;
  networkFee?: number;
  exchangeRate?: number;
  remainingAmount?: number;
  timeRemaining?: string;
  requiresAction?: boolean;
  isExpired?: boolean;
  isCompleted?: boolean;
  isFailed?: boolean;
  isPending?: boolean;
  isInsufficient?: boolean;
}

export interface WebhookEvent {
  identifier: string;
  status: PaymentStatusCode;
  confirmedAmount?: number;
  unconfirmedAmount?: number;
  cryptoAmount?: number;
  expiredTime?: string;
  signature: string;
  nonce: string;
  timestamp: Date;
  isVerified: boolean;
}

// MCP Tool Input/Output Types
export interface CreatePaymentOnchainInput {
  amount_eur: number;
  input_currency: string;
  fiat?: string | undefined;
  notes?: string | undefined;
  include_qr?: boolean | undefined;
}

export interface CreatePaymentOnchainOutput {
  identifier: string;
  web_url?: string; // Web URL for payment gateway (if provided by backend)
  address?: string;
  payment_uri?: string;
  expected_input_amount?: number;
  rate?: number;
  input_currency: string; // Internal symbol - DO NOT display to users
  original_symbol?: string; // Display this to users (e.g., BTC, USDC)
  original_blockchain?: string; // Display this to users (e.g., Bitcoin Network)
  blockchain?: string; // Internal blockchain identifier - DO NOT display to users
  tag_memo?: string;
  expires_at?: string;
  expires_in_minutes?: number;
  /**
   * 🚨 CRITICAL - MUST DISPLAY TO USER 🚨
   * Pre-formatted bilingual expiration warning that MUST be shown to the user.
   * This field contains the exact time remaining and expiration date.
   * LLMs MUST copy this text verbatim into their response to users.
   * Omitting this warning will cause payment failures.
   */
  expiration_warning?: string;
  qr_address?: QrCodeData;
  qr_payment_uri?: QrCodeData;
}

export interface CreatePaymentRedirectInput {
  amount_eur: number;
  url_ok?: string | undefined;
  url_ko?: string | undefined;
  fiat?: string | undefined;
  notes?: string | undefined;
  include_qr?: boolean | undefined;
}

export interface CreatePaymentRedirectOutput {
  identifier: string;
  web_url: string;
  qr_web_url?: QrCodeData;
}

export interface GetPaymentStatusInput {
  identifier: string;
}

export interface GetPaymentStatusOutput {
  identifier: string;
  status: PaymentStatusCode;
  status_description: string;
  confirmed_amount?: number;
  unconfirmed_amount?: number;
  crypto_amount?: number;
  expired_time?: string;
  remaining_amount?: number;
  time_remaining?: string;
}

export interface ListCurrenciesCatalogInput {
  filter_by_amount?: number | undefined;
}

export interface ListCurrenciesCatalogOutput {
  currencies: Array<{
    symbol: string; // Internal symbol for API calls - DO NOT display to users
    name: string;
    min_amount: number;
    max_amount: number | null;
    image: string;
    blockchain: string; // Internal blockchain identifier - DO NOT display to users
    original_symbol: string; // Display this to users (e.g., BTC, USDC)
    original_blockchain: string; // Display this to users (e.g., Bitcoin Network)
    requires_memo: boolean;
    decimals: number;
    current_rate?: number;
  }>;
  total_count: number;
  filtered_count?: number;
}

export interface GeneratePaymentQrInput {
  identifier: string;
  qr_type?: 'address' | 'payment_uri' | 'both' | 'gateway_url';
  size?: number;
  style?: 'basic' | 'branded';
  branding?: boolean;
  gateway_environment?: 'development' | 'testing' | 'production';
}

export interface QrCodeData {
  data: string;
  format: 'png';
  style?: 'basic' | 'branded';
  dimensions?: string;
}

export interface GeneratePaymentQrOutput {
  identifier: string;
  qr_address?: QrCodeData;
  qr_payment_uri?: QrCodeData;
  qr_gateway_url?: QrCodeData;
}

// API Error Types
export interface APIError {
  code: string;
  message: string;
  httpStatus: number;
  details?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

// Configuration Types
export interface Configuration {
  deviceId: string;
  baseUrl: string;
  deviceSecret?: string;
  logLevel: string;
  nodeEnv: string;
  apiTimeout: number;
  maxRetries: number;
  retryDelay: number;
  // Webhook configuration
  webhookEnabled?: boolean;
  webhookPort?: number;
  webhookHost?: string;
  webhookPath?: string;
  // Tunnel configuration
  tunnelEnabled?: boolean;
  tunnelProvider?: 'ngrok' | 'zrok' | 'manual';
  tunnelPublicUrl?: string;
  ngrokAuthToken?: string;
  ngrokDomain?: string;
  zrokToken?: string;
  zrokUniqueName?: string;
  tunnelHealthCheckInterval?: number;
  tunnelReconnectMaxRetries?: number;
  tunnelReconnectBackoffMs?: number;
}

// Bitnovo API Response Types (internal)
export interface UniversalCryptomentResponse {
  identifier: string;
  address?: string;
  payment_uri?: string;
  expected_input_amount?: number;
  rate?: number;
  input_currency?: string;
  web_url?: string;
  tag_memo?: string;
}

export interface BitnovoStatusResponse {
  identifier: string;
  status: PaymentStatusCode;
  confirmed_amount?: number;
  unconfirmed_amount?: number;
  crypto_amount?: number;
  expired_time?: string;
}

export interface BitnovoCurrencyResponse {
  symbol: string; // Internal symbol (e.g., BTC_TEST, USDC_ETH_TEST5)
  name: string;
  min_amount: number;
  max_amount: number | null;
  image: string;
  blockchain: string; // Internal blockchain identifier
  original_symbol: string; // User-facing symbol (e.g., BTC, USDC)
  original_blockchain: string; // User-facing blockchain name
  // Note: requires_memo and decimals might need to be derived or mapped
}

export interface BitnovoCurrenciesResponse {
  currencies: BitnovoCurrencyResponse[];
}

// Webhook Types
export interface WebhookConfiguration {
  enabled: boolean;
  port: number;
  host: string;
  path: string;
  maxEvents: number;
  eventTtlMs: number;
}

export interface GetWebhookEventsInput {
  identifier?: string | undefined;
  limit?: number | undefined;
  validated_only?: boolean | undefined;
}

export interface GetWebhookEventsOutput {
  events: Array<{
    event_id: string;
    identifier: string;
    status: PaymentStatusCode;
    received_at: string;
    validated: boolean;
    payload: Record<string, unknown>;
  }>;
  total_count: number;
}

// Tunnel Types
export interface TunnelConfiguration {
  enabled: boolean;
  provider: 'ngrok' | 'zrok' | 'manual';
  localPort: number;
  publicUrl?: string;
  ngrokAuthToken?: string;
  ngrokDomain?: string;
  zrokToken?: string;
  zrokUniqueName?: string;
  healthCheckInterval: number;
  reconnectMaxRetries: number;
  reconnectBackoffMs: number;
}

export interface GetWebhookUrlInput {
  validate?: boolean;
}

export interface GetWebhookUrlOutput {
  webhook_url: string;
  provider: 'ngrok' | 'zrok' | 'manual';
  validated: boolean;
  instructions?: string;
}

export interface GetTunnelStatusOutput {
  enabled: boolean;
  provider: 'ngrok' | 'zrok' | 'manual';
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  public_url: string | null;
  connected_at: string | null;
  last_error: string | null;
  reconnect_attempts: number;
  health_check_enabled: boolean;
  context_detected?: {
    execution_context: string;
    confidence: number;
    suggested_provider: string;
    indicators: string[];
  };
}
