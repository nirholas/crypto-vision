/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
// MCP tool for querying payment status by identifier

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PaymentService } from '../services/payment-service.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export const getPaymentStatusTool: Tool = {
  name: 'get_payment_status',
  description:
    'Query the current status and details of a payment by its unique identifier. USE THIS WHEN: User wants to check if a payment was completed, or get details about a previously created payment. RESULT: Payment status (PE=Pending, CO=Completed, EX=Expired, CA=Cancelled), amounts, and confirmation info. Status descriptions: PE (Pending): Waiting for customer to pay, CO (Completed): Payment confirmed on blockchain, EX (Expired): Payment time limit exceeded, CA (Cancelled): Payment was cancelled. EXAMPLES: "Check payment status", "Is payment abc-123 completed?", "Status of my payment". Note: Exchange rate is not included in response as it may not be accurate for non-EUR fiat currencies.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        format: 'uuid',
        description: 'Unique payment identifier returned from payment creation',
      },
    },
    required: ['identifier'],
    additionalProperties: false,
  },
};

export class GetPaymentStatusHandler {
  constructor(private readonly paymentService: PaymentService) {}

  async handle(args: unknown): Promise<{
    identifier: string;
    status: string;
    status_description?: string;
    confirmed_amount?: number;
    unconfirmed_amount?: number;
    crypto_amount?: number;
    remaining_amount?: number;
    expired_time?: string;
    network_fee?: number;
    exchange_rate?: number;
    requires_action?: boolean;
    is_expired?: boolean;
    is_completed?: boolean;
    is_failed?: boolean;
  }> {
    const startTime = Date.now();

    logger.info('Processing get_payment_status request', {
      operation: 'get_payment_status',
      timestamp: new Date().toISOString(),
    });

    try {
      // Get payment status through service
      const paymentStatus = await this.paymentService.getPaymentStatus(args);

      const response = {
        identifier: paymentStatus.identifier,
        status: paymentStatus.status,
        status_description: paymentStatus.statusDescription,
        confirmed_amount: paymentStatus.confirmedAmount,
        unconfirmed_amount: paymentStatus.unconfirmedAmount,
        crypto_amount: paymentStatus.cryptoAmount,
        remaining_amount: paymentStatus.remainingAmount,
        expired_time: paymentStatus.expiredTime,
        network_fee: paymentStatus.networkFee,
        // Note: exchange_rate field removed as it's only accurate for EUR
        requires_action: paymentStatus.requiresAction,
        is_expired: paymentStatus.isExpired,
        is_completed: paymentStatus.isCompleted,
        is_failed: paymentStatus.isFailed,
      };

      const duration = Date.now() - startTime;

      logger.info('get_payment_status completed successfully', {
        operation: 'get_payment_status_success',
        paymentId: paymentStatus.identifier,
        status: paymentStatus.status,
        hasAmounts: !!(
          paymentStatus.confirmedAmount || paymentStatus.unconfirmedAmount
        ),
        requiresAction: paymentStatus.requiresAction,
        duration,
        timestamp: new Date().toISOString(),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('get_payment_status failed', error as Error, {
        operation: 'get_payment_status_error',
        duration,
        timestamp: new Date().toISOString(),
      });

      // Re-throw the error to be handled by MCP framework
      throw error;
    }
  }

  /**
   * Get human-readable status description with actionable information
   */
  private getStatusGuidance(
    status: string,
    paymentStatus: { remaining_amount?: number }
  ): string {
    const guidanceMap: Record<string, string> = {
      NR: 'Payment is being initialized. Please wait a moment.',
      PE: 'Payment is ready. Customer should send the cryptocurrency to complete the transaction.',
      AC: 'Payment detected on network. Waiting for confirmation. This may take a few minutes.',
      IA: paymentStatus.remaining_amount
        ? `Insufficient payment received. Customer needs to send an additional ${paymentStatus.remaining_amount} crypto.`
        : 'Insufficient payment received. Customer needs to send the remaining amount.',
      OC: 'Payment conditions not met. Please check the payment details.',
      CO: 'Payment completed successfully. Transaction is confirmed.',
      CA: 'Payment was cancelled.',
      EX: 'Payment has expired. A new payment request is needed.',
      FA: 'Payment failed. Please try again or contact support.',
    };

    return guidanceMap[status] || 'Unknown payment status';
  }

  /**
   * Calculate progress percentage for the payment
   */
  private calculateProgress(paymentStatus: any): number {
    const statusProgress: Record<string, number> = {
      NR: 10, // Payment created
      PE: 25, // Waiting for payment
      AC: 75, // Payment detected, confirming
      IA: 50, // Partial payment received
      OC: 25, // Issue with payment
      CO: 100, // Completed
      CA: 0, // Cancelled
      EX: 0, // Expired
      FA: 0, // Failed
    };

    return statusProgress[paymentStatus.status] || 0;
  }

  /**
   * Determine if the payment status should trigger notifications
   */
  private shouldNotify(status: string, previousStatus?: string): boolean {
    const notificationStatuses = ['CO', 'CA', 'EX', 'FA', 'IA'];

    // Notify on final states or problems
    if (notificationStatuses.includes(status)) {
      return true;
    }

    // Notify on status transitions that matter
    if (previousStatus === 'PE' && status === 'AC') {
      return true; // Payment detected
    }

    return false;
  }

  /**
   * Get next recommended action for the payment status
   */
  private getNextAction(paymentStatus: any): string | undefined {
    switch (paymentStatus.status) {
      case 'NR':
        return 'wait_for_initialization';
      case 'PE':
        return 'send_payment';
      case 'AC':
        return 'wait_for_confirmation';
      case 'IA':
        return 'send_remaining_amount';
      case 'OC':
        return 'check_payment_details';
      case 'CO':
        return 'payment_complete';
      case 'CA':
      case 'EX':
      case 'FA':
        return 'create_new_payment';
      default:
        return undefined;
    }
  }

  /**
   * Validate that the tool response matches the expected schema
   */
  private validateResponse(response: any): boolean {
    // Basic validation that required fields are present
    if (!response || typeof response !== 'object') {
      return false;
    }

    if (!response.identifier || typeof response.identifier !== 'string') {
      return false;
    }

    if (!response.status || typeof response.status !== 'string') {
      return false;
    }

    // Validate UUID format for identifier
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(response.identifier)) {
      logger.warn('Invalid identifier format in response', {
        identifier: response.identifier,
        operation: 'validate_response',
      });
      return false;
    }

    // Validate status code
    const validStatusCodes = [
      'NR',
      'PE',
      'AC',
      'IA',
      'OC',
      'CO',
      'CA',
      'EX',
      'FA',
    ];
    if (!validStatusCodes.includes(response.status)) {
      logger.warn('Invalid status code in response', {
        status: response.status,
        operation: 'validate_response',
      });
      return false;
    }

    return true;
  }

  /**
   * Mask sensitive information in payment status for logging
   */
  private maskSensitiveData(paymentStatus: any): any {
    return {
      identifier: paymentStatus.identifier,
      status: paymentStatus.status,
      hasConfirmedAmount: !!paymentStatus.confirmed_amount,
      hasUnconfirmedAmount: !!paymentStatus.unconfirmed_amount,
      requiresAction: paymentStatus.requires_action,
      isExpired: paymentStatus.is_expired,
    };
  }
}

// Factory function for creating the handler
export function getPaymentStatusHandler(
  paymentService: PaymentService
): GetPaymentStatusHandler {
  return new GetPaymentStatusHandler(paymentService);
}
