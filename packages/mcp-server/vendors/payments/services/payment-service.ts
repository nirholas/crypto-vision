/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// Payment service for business logic and validation

import type {
  Payment,
  PaymentStatus,
  Configuration,
  ApiError,
} from '../types/index.js';
import type { BitnovoApiClient } from '../api/bitnovo-client.js';
import {
  validateCreatePaymentOnchain,
  validateCreatePaymentRedirect,
  validateGetPaymentStatus,
  validateAmountForCurrency,
} from '../utils/validation.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class PaymentServiceError extends Error implements ApiError {
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
    this.name = 'PaymentServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Global cache shared across all PaymentService instances
const globalPaymentCache = new Map<string, Payment>();

export class PaymentService {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly apiClient: BitnovoApiClient,
    private readonly config: Configuration
  ) {}

  /**
   * Create an on-chain cryptocurrency payment
   */
  async createOnchainPayment(input: unknown): Promise<Payment> {
    logger.info('Creating onchain payment', {
      operation: 'create_onchain_payment',
    });

    // Validate input
    const validation = validateCreatePaymentOnchain(input);
    if (!validation.success) {
      logger.warn('Invalid onchain payment input', {
        error: validation.error,
        operation: 'create_onchain_payment_validation',
      });

      throw new PaymentServiceError(
        `Invalid input: ${validation.error.message}`,
        400,
        validation.error.code,
        { field: validation.error.field }
      );
    }

    const validInput = validation.data;

    try {
      // Get available currencies to validate the requested currency
      const currencies = await this.apiClient.getCurrencies();
      const requestedCurrency = currencies.find(
        c => c.symbol === validInput.input_currency
      );

      if (!requestedCurrency) {
        throw new PaymentServiceError(
          `Currency ${validInput.input_currency} is not supported`,
          400,
          'INVALID_CURRENCY',
          { requestedCurrency: validInput.input_currency }
        );
      }

      if (!requestedCurrency.isActive) {
        throw new PaymentServiceError(
          `Currency ${validInput.input_currency} is currently not available`,
          400,
          'CURRENCY_INACTIVE',
          { currency: validInput.input_currency }
        );
      }

      // Validate amount against currency limits
      const amountValidation = validateAmountForCurrency(
        validInput.amount_eur,
        requestedCurrency
      );
      if (!amountValidation.success) {
        throw new PaymentServiceError(
          amountValidation.error.message,
          400,
          amountValidation.error.code,
          {
            currency: validInput.input_currency,
            amount: validInput.amount_eur,
            minAmount: requestedCurrency.minAmount,
            maxAmount: requestedCurrency.maxAmount,
          }
        );
      }

      // Create the payment through API
      const payment = await this.apiClient.createOnchainPayment(validInput);

      // Cache the payment data globally for later retrieval (e.g., for QR generation)
      globalPaymentCache.set(payment.identifier, payment);
      logger.debug('Payment cached globally', {
        paymentId: payment.identifier,
        hasAddress: !!payment.address,
        hasPaymentUri: !!payment.paymentUri,
        operation: 'cache_payment',
      });

      // Log success with masked sensitive data
      logger.info('Onchain payment created successfully', {
        paymentId: payment.identifier,
        currency: payment.currency,
        amount: payment.amount,
        hasAddress: !!payment.address,
        hasPaymentUri: !!payment.paymentUri,
        operation: 'create_onchain_payment_success',
      });

      return payment;
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        throw error;
      }

      logger.error('Failed to create onchain payment', error as Error, {
        operation: 'create_onchain_payment_error',
      });

      // Re-throw API errors with context
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }

      throw new PaymentServiceError(
        'Internal error creating onchain payment',
        500,
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Create a web redirect payment
   */
  async createRedirectPayment(input: unknown): Promise<Payment> {
    logger.info('Creating redirect payment', {
      operation: 'create_redirect_payment',
    });

    // Validate input
    const validation = validateCreatePaymentRedirect(input);
    if (!validation.success) {
      logger.warn('Invalid redirect payment input', {
        error: validation.error,
        operation: 'create_redirect_payment_validation',
      });

      throw new PaymentServiceError(
        `Invalid input: ${validation.error.message}`,
        400,
        validation.error.code,
        { field: validation.error.field }
      );
    }

    const validInput = validation.data;

    try {
      // Validate URLs are accessible (basic validation) - only if provided
      if (validInput.url_ok && validInput.url_ko) {
        this.validateRedirectUrls(validInput.url_ok, validInput.url_ko);
      }

      // Create the payment through API
      const payment = await this.apiClient.createRedirectPayment(validInput);

      // Cache the payment data globally for later retrieval
      globalPaymentCache.set(payment.identifier, payment);
      logger.debug('Redirect payment cached globally', {
        paymentId: payment.identifier,
        hasWebUrl: !!payment.webUrl,
        operation: 'cache_redirect_payment',
      });

      // Log success with masked sensitive data
      logger.info('Redirect payment created successfully', {
        paymentId: payment.identifier,
        amount: payment.amount,
        hasWebUrl: !!payment.webUrl,
        operation: 'create_redirect_payment_success',
      });

      return payment;
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        throw error;
      }

      logger.error('Failed to create redirect payment', error as Error, {
        operation: 'create_redirect_payment_error',
      });

      // Re-throw API errors with context
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }

      throw new PaymentServiceError(
        'Internal error creating redirect payment',
        500,
        'INTERNAL_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Get full payment details by identifier
   */
  async getPaymentDetails(identifier: string): Promise<Payment> {
    logger.info('Getting payment details', {
      operation: 'get_payment_details',
      paymentId: identifier,
    });

    // Validate identifier format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      !identifier ||
      typeof identifier !== 'string' ||
      !uuidRegex.test(identifier)
    ) {
      throw new PaymentServiceError(
        'Invalid payment identifier format',
        400,
        'INVALID_IDENTIFIER'
      );
    }

    try {
      // First check global cache for recently created payments
      const cachedPayment = globalPaymentCache.get(identifier);
      if (cachedPayment) {
        logger.info('Payment details retrieved from cache', {
          paymentId: identifier,
          hasAddress: !!cachedPayment.address,
          hasPaymentUri: !!cachedPayment.paymentUri,
          hasWebUrl: !!cachedPayment.webUrl,
          operation: 'get_payment_details_cache_hit',
        });
        return cachedPayment;
      }

      logger.info('Payment not in cache, attempting API retrieval', {
        paymentId: identifier,
        operation: 'get_payment_details_api_attempt',
      });

      // Get payment details from API (with fallback)
      const paymentDetails = await this.apiClient.getPaymentDetails(identifier);

      logger.info('Payment details retrieved successfully', {
        paymentId: identifier,
        hasAddress: !!paymentDetails.address,
        hasPaymentUri: !!paymentDetails.paymentUri,
        hasWebUrl: !!paymentDetails.webUrl,
        operation: 'get_payment_details_success',
      });

      return paymentDetails;
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        throw error;
      }

      logger.error('Failed to get payment details', error as Error, {
        paymentId: identifier,
        operation: 'get_payment_details_error',
      });

      // Re-throw API errors with context
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }

      throw new PaymentServiceError(
        'Internal error getting payment details',
        500,
        'INTERNAL_ERROR',
        { originalError: error, paymentId: identifier }
      );
    }
  }

  /**
   * Get payment status by identifier
   */
  async getPaymentStatus(input: unknown): Promise<PaymentStatus> {
    logger.info('Getting payment status', {
      operation: 'get_payment_status',
    });

    // Validate input
    const validation = validateGetPaymentStatus(input);
    if (!validation.success) {
      logger.warn('Invalid payment status input', {
        error: validation.error,
        operation: 'get_payment_status_validation',
      });

      throw new PaymentServiceError(
        `Invalid input: ${validation.error.message}`,
        400,
        validation.error.code,
        { field: validation.error.field }
      );
    }

    const validInput = validation.data;

    try {
      // Get payment status from API
      const paymentStatus = await this.apiClient.getPaymentStatus(
        validInput.identifier
      );

      // Enhance status with business logic
      const enhancedStatus = this.enhancePaymentStatus(paymentStatus);

      logger.info('Payment status retrieved successfully', {
        paymentId: validInput.identifier,
        status: enhancedStatus.status,
        hasAmounts: !!(
          enhancedStatus.confirmedAmount || enhancedStatus.unconfirmedAmount
        ),
        operation: 'get_payment_status_success',
      });

      return enhancedStatus;
    } catch (error) {
      if (error instanceof PaymentServiceError) {
        throw error;
      }

      logger.error('Failed to get payment status', error as Error, {
        paymentId: validInput.identifier,
        operation: 'get_payment_status_error',
      });

      // Re-throw API errors with context
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error;
      }

      throw new PaymentServiceError(
        'Internal error getting payment status',
        500,
        'INTERNAL_ERROR',
        { originalError: error, paymentId: validInput.identifier }
      );
    }
  }

  /**
   * Validate redirect URLs are properly formatted
   */
  private validateRedirectUrls(urlOk: string, urlKo: string): void {
    const errors: string[] = [];

    // Basic URL validation (more comprehensive than just URL constructor)
    try {
      const okUrl = new URL(urlOk);
      if (!['http:', 'https:'].includes(okUrl.protocol)) {
        errors.push('url_ok must use HTTP or HTTPS protocol');
      }
    } catch {
      errors.push('url_ok is not a valid URL');
    }

    try {
      const koUrl = new URL(urlKo);
      if (!['http:', 'https:'].includes(koUrl.protocol)) {
        errors.push('url_ko must use HTTP or HTTPS protocol');
      }
    } catch {
      errors.push('url_ko is not a valid URL');
    }

    // Ensure URLs are different
    if (urlOk === urlKo) {
      errors.push('Success and failure URLs must be different');
    }

    if (errors.length > 0) {
      throw new PaymentServiceError(
        `Invalid redirect URLs: ${errors.join(', ')}`,
        400,
        'INVALID_REDIRECT_URLS',
        { errors }
      );
    }
  }

  /**
   * Enhance payment status with additional business logic and user-friendly information
   */
  private enhancePaymentStatus(status: PaymentStatus): PaymentStatus {
    // Add status description based on code
    const statusDescriptions = {
      NR: 'Payment created, waiting for cryptocurrency assignment',
      PE: 'Payment pending, waiting for customer transaction',
      AC: 'Payment detected, awaiting network confirmation',
      IA: 'Insufficient amount received, additional payment needed',
      OC: 'Payment conditions not met',
      CO: 'Payment completed and confirmed',
      CA: 'Payment cancelled',
      EX: 'Payment expired',
      FA: 'Payment failed',
    };

    // Calculate remaining amount for insufficient payments
    let remainingAmount: number | undefined;
    if (status.status === 'IA' && status.cryptoAmount) {
      const totalReceived =
        (status.confirmedAmount || 0) + (status.unconfirmedAmount || 0);
      remainingAmount = Math.max(0, status.cryptoAmount - totalReceived);
    }

    // Determine if payment requires action
    const requiresAction = ['PE', 'IA'].includes(status.status);

    // Check if payment is expired
    const isExpired = status.expiredTime
      ? new Date(status.expiredTime) < new Date()
      : false;

    return {
      ...status,
      statusDescription:
        statusDescriptions[status.status as keyof typeof statusDescriptions],
      remainingAmount,
      requiresAction: requiresAction && !isExpired,
      isExpired,
      // Add helper flags
      isPending: status.status === 'PE',
      isCompleted: status.status === 'CO',
      isFailed: ['CA', 'EX', 'FA'].includes(status.status),
      isInsufficient: status.status === 'IA',
    };
  }

  /**
   * Check if a payment has expired based on current time
   */
  isPaymentExpired(expirationTime: string): boolean {
    try {
      const expiredAt = new Date(expirationTime);
      return expiredAt < new Date();
    } catch {
      return false; // If we can't parse the date, assume not expired
    }
  }

  /**
   * Calculate payment timeout based on configuration
   */
  getPaymentTimeout(): number {
    // Default payment timeout is 1 hour (3600 seconds)
    // This could be made configurable in the future
    return 3600;
  }

  /**
   * Format amount for display with proper decimal places
   */
  formatAmount(amount: number, currency?: string): string {
    const decimals = this.getCurrencyDecimals(currency);
    return amount.toFixed(decimals);
  }

  /**
   * Get decimal places for a currency
   */
  private getCurrencyDecimals(currency?: string): number {
    if (!currency) return 2; // Default for EUR

    const decimalsMap: Record<string, number> = {
      BTC: 8,
      ETH: 6,
      LTC: 8,
      BCH: 8,
      XRP: 6,
      XLM: 7,
      ALGO: 6,
      USDC: 2,
      EUR: 2,
      USD: 2,
    };

    return decimalsMap[currency.toUpperCase()] || 8;
  }
}
