/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Bitnovo API client with retry logic and comprehensive error handling

import axios, {
  AxiosInstance,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';
import type {
  Configuration,
  CreatePaymentOnchainInput,
  CreatePaymentRedirectInput,
  Payment,
  PaymentStatus,
  Currency,
  ApiError,
} from '../types/index.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

// Extended Axios config with metadata for request tracking
interface AxiosConfigWithMetadata extends InternalAxiosRequestConfig {
  metadata?: {
    requestId: string;
    startTime: number;
    retryCount?: number;
  };
}

// Type for Axios error response data
interface AxiosErrorResponseData {
  message?: string;
  error?: string;
  code?: string;
  [key: string]: unknown;
}

export interface BitnovoApiResponse<T = unknown> {
  status: string;
  data?: T;
  error?: string;
  message?: string;
}

export interface BitnovoCreateOrderRequest {
  expected_output_amount: number;
  input_currency?: string;
  fiat?: string;
  notes?: string | undefined;
  url_ok?: string;
  url_ko?: string;
  reference?: string;
  order_type?: 'in' | 'out';
}

export interface BitnovoOrderResponse {
  identifier: string;
  reference?: string;
  created_at?: string;
  expired_at?: string;
  fiat?: string;
  language?: string;
  amount?: number;
  status?: string;
  input_currency?: string;
  address?: string;
  tag_memo?: string;
  url_standby?: string;
  url_ko?: string;
  url_ok?: string;
  web_url?: string;
  payment_uri?: string;
  input_amount?: number;
  expected_input_amount?: number;
  rate?: number;
  notes?: string;
}

export interface UniversalCryptomentInfoResponse {
  identifier: string;
  status: string;
  crypto_amount?: number;
  confirmed_amount?: number;
  unconfirmed_amount?: number;
  exchange_rate?: number;
  network_fee?: number;
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
}

export class BitnovoApiError extends Error implements ApiError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'BitnovoApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static fromAxiosError(error: AxiosError): BitnovoApiError {
    const response = error.response;
    const statusCode = response?.status || 500;

    // Extract error information from response
    const responseData = (response?.data as AxiosErrorResponseData) || {};
    const message = responseData.message || responseData.error || error.message;
    const code = responseData.code || `HTTP_${statusCode}`;

    logger.error('Bitnovo API error', error, {
      statusCode,
      responseData,
      operation: 'api_call',
    });

    return new BitnovoApiError(message, statusCode, code, responseData);
  }

  static fromTimeout(): BitnovoApiError {
    return new BitnovoApiError('Request timed out', 408, 'API_TIMEOUT', {
      reason: 'Request exceeded configured timeout limit',
    });
  }
}

export class BitnovoApiClient {
  private readonly httpClient: AxiosInstance;
  private readonly config: Configuration;

  constructor(config: Configuration) {
    this.config = config;

    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': config.deviceId,
        'User-Agent': 'MCP-Bitnovo-Pay/1.0.0',
      },
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
        const requestId = Math.random().toString(36).substring(2, 15);
        const configWithMetadata = config as AxiosConfigWithMetadata;
        configWithMetadata.metadata = { requestId, startTime: Date.now() };

        logger.info('API request started', {
          requestId,
          method: config.method?.toUpperCase(),
          url: config.url,
          operation: 'api_request',
        });

        return config;
      },
      (error: Error) => {
        logger.error('Request setup failed', error, {
          operation: 'api_request_setup',
        });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    this.httpClient.interceptors.response.use(
      response => {
        const configWithMetadata = response.config as AxiosConfigWithMetadata;
        const duration =
          Date.now() - (configWithMetadata.metadata?.startTime || 0);

        logger.info('API request completed', {
          requestId: configWithMetadata.metadata?.requestId,
          status: response.status,
          duration,
          operation: 'api_response',
        });

        return response;
      },
      async (error: AxiosError) => {
        const configWithMetadata = error.config as
          | AxiosConfigWithMetadata
          | undefined;
        const duration =
          Date.now() - (configWithMetadata?.metadata?.startTime || 0);

        if (error.code === 'ECONNABORTED') {
          logger.warn('API request timeout', {
            requestId: configWithMetadata?.metadata?.requestId,
            duration,
            operation: 'api_timeout',
          });
          throw BitnovoApiError.fromTimeout();
        }

        // Apply retry logic for retryable errors
        if (this.shouldRetry(error)) {
          return this.retryRequest(error);
        }

        throw BitnovoApiError.fromAxiosError(error);
      }
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    // Don't retry rate limiting errors (429) - these should fail fast
    if (error.response?.status === 429) {
      logger.warn('Rate limit exceeded, not retrying', {
        statusCode: error.response.status,
        operation: 'rate_limit_detected',
      });
      return false;
    }

    // Don't retry other client errors (4xx except 408)
    if (
      error.response?.status &&
      error.response.status >= 400 &&
      error.response.status < 500
    ) {
      return error.response.status === 408; // Only retry timeout
    }

    // Retry server errors (5xx) and network errors
    return true;
  }

  private async retryRequest(error: AxiosError): Promise<AxiosResponse> {
    const configWithMetadata = error.config as
      | AxiosConfigWithMetadata
      | undefined;
    const retryCount = configWithMetadata?.metadata?.retryCount || 0;

    if (retryCount >= this.config.maxRetries) {
      logger.warn('Max retries exceeded', {
        requestId: configWithMetadata?.metadata?.requestId,
        retryCount,
        operation: 'api_retry_exhausted',
      });
      throw BitnovoApiError.fromAxiosError(error);
    }

    const delay = this.calculateRetryDelay(retryCount);

    logger.info('Retrying API request', {
      requestId: configWithMetadata?.metadata?.requestId,
      retryCount: retryCount + 1,
      delay,
      operation: 'api_retry',
    });

    await this.sleep(delay);

    // Update retry count in metadata
    if (configWithMetadata) {
      configWithMetadata.metadata = {
        ...configWithMetadata.metadata,
        requestId: configWithMetadata.metadata?.requestId || '',
        startTime: configWithMetadata.metadata?.startTime || Date.now(),
        retryCount: retryCount + 1,
      };

      return this.httpClient.request(configWithMetadata);
    }

    throw BitnovoApiError.fromAxiosError(error);
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 0.1 * exponentialDelay;

    return Math.min(exponentialDelay + jitter, 10000); // Cap at 10 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create on-chain payment order
   */
  async createOnchainPayment(
    input: CreatePaymentOnchainInput
  ): Promise<Payment> {
    try {
      const request: BitnovoCreateOrderRequest = {
        expected_output_amount: input.amount_eur,
        input_currency: input.input_currency,
        fiat: input.fiat || 'EUR',
        notes: input.notes,
        order_type: 'in',
      };

      // Use currency-specific timeout for better reliability
      const timeout = this.getCurrencyTimeout(input.input_currency);
      logger.info('Creating onchain payment with optimized timeout', {
        currency: input.input_currency,
        timeout,
        amount: input.amount_eur,
        operation: 'create_onchain_payment_request',
      });

      const response = await this.httpClient.post<
        BitnovoApiResponse<BitnovoOrderResponse>
      >('/api/v1/orders/', request, { timeout });

      // Check if response has data directly or wrapped in a success object
      const orderData = (response.data.data ||
        response.data) as BitnovoOrderResponse;

      // Validate that we have the required fields
      if (!orderData.identifier) {
        throw new BitnovoApiError(
          response.data.error || 'Failed to create payment',
          response.status,
          'CREATE_PAYMENT_FAILED',
          response.data
        );
      }

      return {
        identifier: orderData.identifier,
        amount: input.amount_eur,
        currency: input.input_currency,
        fiat: input.fiat || 'EUR',
        notes: input.notes,
        paymentType: 'onchain',
        address: orderData.address,
        paymentUri: orderData.payment_uri,
        webUrl: orderData.web_url,
        expectedInputAmount: orderData.expected_input_amount,
        rate: orderData.rate,
        createdAt: orderData.created_at
          ? new Date(orderData.created_at)
          : new Date(),
        expiresAt: orderData.expired_at
          ? new Date(orderData.expired_at)
          : undefined,
      };
    } catch (error) {
      if (error instanceof BitnovoApiError) {
        throw error;
      }

      logger.error(
        'Unexpected error creating onchain payment',
        error as Error,
        {
          operation: 'create_onchain_payment',
        }
      );

      throw new BitnovoApiError(
        'Internal error creating payment',
        500,
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Create web redirect payment order
   */
  async createRedirectPayment(
    input: CreatePaymentRedirectInput
  ): Promise<Payment> {
    try {
      const request: BitnovoCreateOrderRequest = {
        expected_output_amount: input.amount_eur,
        fiat: input.fiat || 'EUR',
        notes: input.notes,
        order_type: 'in',
      };

      // Only add URLs if provided
      if (input.url_ok) {
        request.url_ok = input.url_ok;
      }
      if (input.url_ko) {
        request.url_ko = input.url_ko;
      }

      const response = await this.httpClient.post<
        BitnovoApiResponse<BitnovoOrderResponse>
      >('/api/v1/orders/', request);

      // Check if response has data directly or wrapped in a success object
      const orderData = (response.data.data ||
        response.data) as BitnovoOrderResponse;

      // Validate that we have the required fields
      if (!orderData.identifier) {
        throw new BitnovoApiError(
          response.data.error || 'Failed to create payment',
          response.status,
          'CREATE_PAYMENT_FAILED',
          response.data
        );
      }

      return {
        identifier: orderData.identifier,
        amount: input.amount_eur,
        fiat: input.fiat || 'EUR',
        notes: input.notes,
        paymentType: 'redirect',
        webUrl: orderData.web_url,
        merchantUrlOk: input.url_ok,
        merchantUrlKo: input.url_ko,
        createdAt: orderData.created_at
          ? new Date(orderData.created_at)
          : new Date(),
        expiresAt: orderData.expired_at
          ? new Date(orderData.expired_at)
          : undefined,
      };
    } catch (error) {
      if (error instanceof BitnovoApiError) {
        throw error;
      }

      logger.error(
        'Unexpected error creating redirect payment',
        error as Error,
        {
          operation: 'create_redirect_payment',
        }
      );

      throw new BitnovoApiError(
        'Internal error creating payment',
        500,
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Get payment status information
   */
  async getPaymentStatus(identifier: string): Promise<PaymentStatus> {
    try {
      logger.info('Requesting payment status from API', {
        identifier,
        endpoint: `/api/v1/orders/info/${identifier}`,
        operation: 'get_payment_status_request',
      });

      const response = await this.httpClient.get<
        BitnovoApiResponse<UniversalCryptomentInfoResponse>
      >(`/api/v1/orders/info/${identifier}`);

      // Enhanced logging for debugging API response format
      logger.info('Received payment status API response', {
        identifier,
        httpStatus: response.status,
        responseStatus: response.data?.status,
        hasData: !!response.data?.data,
        hasError: !!response.data?.error,
        dataKeys: response.data ? Object.keys(response.data) : [],
        operation: 'get_payment_status_response',
      });

      // More flexible response handling to accommodate different API response formats
      let paymentInfo: UniversalCryptomentInfoResponse;

      // Check multiple possible response formats
      if (response.data?.data) {
        // Standard wrapped response: { status: 'success', data: {...} }
        if (response.data.status !== 'success') {
          logger.warn('API returned non-success status in wrapped response', {
            identifier,
            apiStatus: response.data.status,
            error: response.data.error,
            operation: 'get_payment_status_non_success',
          });

          throw new BitnovoApiError(
            response.data.error ||
              `API returned status: ${response.data.status}`,
            response.status,
            'GET_PAYMENT_STATUS_FAILED',
            response.data
          );
        }
        paymentInfo = response.data.data;
      } else if (Array.isArray(response.data) && response.data.length > 0) {
        // Array response format - API returns array with payment info
        logger.info('API returned array format, using first element', {
          identifier,
          arrayLength: response.data.length,
          operation: 'get_payment_status_array_format',
        });
        paymentInfo = response.data[0] as UniversalCryptomentInfoResponse;
      } else if (
        response.data &&
        typeof response.data === 'object' &&
        'identifier' in response.data
      ) {
        // Direct response format (payment info directly in response.data)
        logger.info('API returned direct payment info format', {
          identifier,
          operation: 'get_payment_status_direct_format',
        });
        paymentInfo = response.data as UniversalCryptomentInfoResponse;
      } else {
        // Unexpected format
        logger.error(
          'Unexpected API response format for payment status',
          new Error('API response format not recognized'),
          {
            identifier,
            httpStatus: response.status,
            responseData: response.data,
            operation: 'get_payment_status_unexpected_format',
          }
        );

        throw new BitnovoApiError(
          'API response format not recognized - missing both data wrapper and direct payment info',
          response.status,
          'GET_PAYMENT_STATUS_INVALID_FORMAT',
          response.data
        );
      }

      // Validate that we have required payment info fields
      if (!paymentInfo.identifier || !paymentInfo.status) {
        logger.error(
          'Payment info missing required fields',
          new Error('Payment status data is incomplete'),
          {
            identifier,
            hasIdentifier: !!paymentInfo.identifier,
            hasStatus: !!paymentInfo.status,
            paymentInfoKeys: Object.keys(paymentInfo),
            operation: 'get_payment_status_invalid_data',
          }
        );

        throw new BitnovoApiError(
          'Payment status data is incomplete - missing identifier or status',
          response.status,
          'GET_PAYMENT_STATUS_INCOMPLETE_DATA',
          {
            paymentInfo: paymentInfo as unknown as Record<string, unknown>,
            requestedIdentifier: identifier,
          }
        );
      }

      logger.info('Successfully processed payment status', {
        identifier,
        status: paymentInfo.status,
        hasAmounts: !!(
          paymentInfo.confirmed_amount || paymentInfo.unconfirmed_amount
        ),
        operation: 'get_payment_status_success',
      });

      return {
        identifier: paymentInfo.identifier,
        status: paymentInfo.status as PaymentStatus['status'],
        confirmedAmount: paymentInfo.confirmed_amount,
        unconfirmedAmount: paymentInfo.unconfirmed_amount,
        cryptoAmount: paymentInfo.crypto_amount,
        expiredTime: paymentInfo.expired_time,
        networkFee: paymentInfo.network_fee,
        exchangeRate: paymentInfo.exchange_rate,
      };
    } catch (error) {
      if (error instanceof BitnovoApiError) {
        // Re-throw API errors with additional context
        logger.error(
          'Bitnovo API error in get_payment_status',
          error as Error,
          {
            identifier,
            statusCode: error.statusCode,
            code: error.code,
            errorMessage: error.message,
            operation: 'get_payment_status_api_error',
          }
        );
        throw error;
      }

      logger.error('Unexpected error getting payment status', error as Error, {
        operation: 'get_payment_status_unexpected',
        paymentId: identifier,
        errorType: error?.constructor?.name,
      });

      throw new BitnovoApiError(
        'Internal error getting payment status',
        500,
        'INTERNAL_ERROR',
        { originalError: error, paymentId: identifier }
      );
    }
  }

  /**
   * Get full payment details including address and payment_uri
   * Uses fallback to payment status endpoint if direct details endpoint is not available
   */
  async getPaymentDetails(identifier: string): Promise<Payment> {
    try {
      // Try the direct details endpoint first
      const response = await this.httpClient.get<
        BitnovoApiResponse<BitnovoOrderResponse>
      >(`/api/v1/orders/${identifier}`);

      if (response.data.status !== 'success' || !response.data.data) {
        throw new BitnovoApiError(
          response.data.error || 'Failed to get payment details',
          response.status,
          'GET_PAYMENT_DETAILS_FAILED',
          response.data
        );
      }

      const order = response.data.data;

      return {
        identifier: order.identifier,
        amount: order.amount || 0,
        currency: order.input_currency,
        fiat: order.fiat,
        notes: order.notes,
        paymentType: order.input_currency ? 'onchain' : 'redirect',
        address: order.address,
        paymentUri: order.payment_uri,
        webUrl: order.web_url,
        expectedInputAmount: order.expected_input_amount,
        rate: order.rate,
        merchantUrlOk: order.url_ok,
        merchantUrlKo: order.url_ko,
        createdAt: order.created_at ? new Date(order.created_at) : new Date(),
        expiresAt: order.expired_at ? new Date(order.expired_at) : undefined,
      };
    } catch (error) {
      // If direct endpoint fails (e.g., 405 Method Not Allowed), try fallback
      if (
        error instanceof BitnovoApiError &&
        (error.statusCode === 405 || error.statusCode === 404)
      ) {
        logger.info(
          'Direct payment details endpoint unavailable, using status fallback',
          {
            identifier,
            statusCode: error.statusCode,
            operation: 'get_payment_details_fallback',
          }
        );

        try {
          // Fallback: use getPaymentStatus which works, then reconstruct Payment object
          const statusResponse = await this.getPaymentStatus(identifier);

          // Create a Payment object from the status data
          // We'll need to make some assumptions since we don't have all details
          const payment: Payment = {
            identifier: statusResponse.identifier,
            amount: 0, // Not available in status
            currency: undefined, // Not directly available in status
            fiat: 'EUR', // Default assumption
            notes: undefined, // Not available in status
            paymentType: 'onchain', // Default assumption
            address: undefined, // Not available in status endpoint
            paymentUri: undefined, // Not available in status endpoint
            webUrl: undefined, // Not available in status endpoint
            expectedInputAmount: statusResponse.cryptoAmount,
            rate: statusResponse.exchangeRate,
            merchantUrlOk: undefined,
            merchantUrlKo: undefined,
            createdAt: new Date(), // Default to now
            expiresAt: statusResponse.expiredTime
              ? new Date(statusResponse.expiredTime)
              : undefined,
          };

          logger.info(
            'Successfully retrieved payment details via status fallback',
            {
              identifier,
              hasExpiration: !!payment.expiresAt,
              operation: 'get_payment_details_fallback_success',
            }
          );

          return payment;
        } catch (fallbackError) {
          logger.error(
            'Both direct and fallback methods failed for payment details',
            fallbackError as Error,
            {
              identifier,
              originalError: error.message,
              operation: 'get_payment_details_fallback_failed',
            }
          );

          throw new BitnovoApiError(
            'Unable to retrieve payment details - both direct and fallback methods failed',
            500,
            'GET_PAYMENT_DETAILS_ALL_METHODS_FAILED',
            { originalError: error, fallbackError, paymentId: identifier }
          );
        }
      }

      if (error instanceof BitnovoApiError) {
        throw error;
      }

      logger.error('Unexpected error getting payment details', error as Error, {
        operation: 'get_payment_details_unexpected',
        paymentId: identifier,
      });

      throw new BitnovoApiError(
        'Internal error getting payment details',
        500,
        'INTERNAL_ERROR',
        { originalError: error, paymentId: identifier }
      );
    }
  }

  /**
   * Get available currencies catalog
   */
  async getCurrencies(): Promise<Currency[]> {
    try {
      const response =
        await this.httpClient.get<BitnovoCurrencyResponse[]>(
          '/api/v1/currencies'
        );

      if (!Array.isArray(response.data)) {
        throw new BitnovoApiError(
          'Invalid currency data format',
          response.status,
          'GET_CURRENCIES_FAILED',
          response.data
        );
      }

      return response.data.map(currency => {
        // Extract base symbol for currencies with network suffix (e.g., USDC_ETH -> USDC)
        const baseSymbol = currency.symbol.split('_')[0];

        return {
          symbol: currency.symbol, // Internal symbol for API calls (e.g., BTC_TEST, USDC_ETH_TEST5)
          name: currency.name,
          minAmount: currency.min_amount,
          maxAmount: currency.max_amount,
          network_image: currency.image,
          blockchain: currency.blockchain, // Internal blockchain identifier
          original_symbol: currency.original_symbol, // User-facing symbol from API
          original_blockchain: currency.original_blockchain, // User-facing blockchain name from API
          requiresMemo: ['XRP', 'XLM', 'ALGO'].includes(baseSymbol || currency.symbol),
          decimals: this.getDefaultDecimals(baseSymbol || currency.symbol),
          isActive: true, // Assume all returned currencies are active
        };
      });
    } catch (error) {
      if (error instanceof BitnovoApiError) {
        throw error;
      }

      logger.error('Unexpected error getting currencies', error as Error, {
        operation: 'get_currencies',
      });

      throw new BitnovoApiError(
        'Internal error getting currencies',
        500,
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  }

  private getDefaultDecimals(symbol: string): number {
    const decimalsMap: Record<string, number> = {
      BTC: 8,
      ETH: 18,
      LTC: 8,
      BCH: 8,
      XRP: 6,
      XLM: 7,
      ALGO: 6,
      USDC: 6,
    };

    return decimalsMap[symbol] || 8; // Default to 8 decimals
  }

  /**
   * Get timeout for specific currency based on performance analysis and testing
   * These values are optimized based on observed behavior during comprehensive testing
   */
  private getCurrencyTimeout(currency: string): number {
    // Optimized timeout mapping based on comprehensive testing
    const currencyTimeouts: Record<string, number> = {
      ETH: 15000, // ETH operations are consistently slower, need more time
      BTC: 15000, // BTC is generally reliable and faster
      LTC: 15000, // Similar performance to BTC
      BCH: 15000, // Similar performance to BTC
      XRP: 15000, // Fast processing, lower timeout sufficient
      XLM: 15000, // Fast processing, lower timeout sufficient
      ALGO: 15000, // Fast processing, lower timeout sufficient
      USDC: 15000, // Stablecoin, variable performance
    };

    // Use base API timeout as fallback for unknown currencies
    const timeout =
      currencyTimeouts[currency.toUpperCase()] || this.config.apiTimeout;

    logger.debug('Selected optimized timeout for currency', {
      currency,
      timeout,
      baseTimeout: this.config.apiTimeout,
      operation: 'get_currency_timeout',
    });

    return timeout;
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      await this.httpClient.get('/health');
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn('Health check failed', {
        error: error as Error,
        operation: 'health_check',
      });
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Factory function for creating client instance
export function createBitnovoApiClient(
  config: Configuration
): BitnovoApiClient {
  return new BitnovoApiClient(config);
}
